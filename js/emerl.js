import { configureCombatant } from './combat-system.js';

import { beginRobotMove, hitRobotMove, updateRobotMove } from './robot-combat.js';
import { opaqueFramesOverlap, opaqueInRect } from './pixel-collision.js';
import { combatNow } from './combat-clock.js';
import { ctx, game } from './state.js';
import { initBuster, getBusterLevel } from './buster-system.js';
import { Rock, rockPaletteRGB } from './rock.js';
import { copyShieldAnimations, shieldLayers, shieldIntersects } from './emerl-shield.js';
import { EMERL_FRAMES } from './emerl-frames.js';

const atlas = new Image();
atlas.src = 'assets/images/emerl-atlas.png';

const attacks = {
    punch: { active: [2, 3], damage: 7, range: 62, top: 85 },
    upper: { active: [1, 3], damage: 12, range: 70, top: 120, launch: -9 },
    waveKick: { active: [1, 2], damage: 6, range: 70, top: 80 },
    roundhouse: { active: [2, 6], damage: 11, range: 95, top: 105 },
    sword: { active: [1, 2], damage: 12, range: 94, top: 105 },
    rocket: { active: [2, 4], damage: 13, range: 86, top: 95, speed: 12 }
};

export function frameFor(key, index, x, feet, scale, direction) {
    if (!atlas.complete || !atlas.naturalWidth) return null;
    const info = EMERL_FRAMES[key];
    return { img: atlas, sx: index * 72, sy: info.row * 64, sw: 72, sh: 64,
        dx: x - 36 * scale, dy: feet - 64 * scale, dw: 72 * scale, dh: 64 * scale, flipX: direction < 0 };
}

const palette = new Image();
palette.src = 'assets/images/emerl-palette.png';
const copies = new Map();
function copyPalette(frame, mode) {
    if (!frame || !mode || !palette.complete || !palette.naturalWidth) return frame;
    if (!copies.has(mode)) {
        const canvas = document.createElement('canvas');
        canvas.width = atlas.naturalWidth;
        canvas.height = atlas.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(palette, 0, 0);
        const swatches = ctx.getImageData(0, 3, 120, 1).data;
        const read = i => [swatches[i * 32], swatches[i * 32 + 1], swatches[i * 32 + 2]];
        const indices = [2, 3, 4, 5];
        const targets = {
            cut: [[254, 244, 200], [210, 175, 103], [135, 100, 52], [74, 55, 33]],
            leaf: [[227, 251, 158], [132, 203, 70], [76, 138, 44], [43, 75, 30]],
            fire: [read(6), [255, 148, 40], [211, 55, 27], [113, 34, 26]],
        }[mode] ?? rockPaletteRGB[Number(mode.slice(6))]?.slice(5, 9);
        if (!targets) return frame;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(atlas, 0, 0);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const source = indices.map(read);
        for (let i = 0; i < image.data.length; i += 4) {
            if (!image.data[i + 3]) continue;
            const index = source.findIndex(([r,g,b]) => image.data[i] === r && image.data[i+1] === g && image.data[i+2] === b);
            if (index >= 0) image.data.set(targets[index], i);
        }
        ctx.putImageData(image, 0, 0);
        copies.set(mode, canvas);
    }
    return { ...frame, img: copies.get(mode) };
}

function drawFrame(frame, camera) {
    if (!frame) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(frame.dx - camera + (frame.flipX ? frame.dw : 0), frame.dy);
    if (frame.flipX) ctx.scale(-1, 1);
    ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, frame.dw, frame.dh);
    ctx.restore();
}

export class Emerl extends Rock {
    constructor(x, y, controls) {
        super(x, y, controls);
        this.rockSize = { height: this.height, width: this.width, characterScale: this.characterScale };
        configureCombatant(this, 'emerl', 'EMERL');
        this.emerlSpriteHeight = this.height;
        this.characterName = 'EMERL';
        this.prototypeColor = '#e8c14a';
        this.hasBuster = false;
        this.hasSonicJump = true;
        this.supportsSpin = true;
        this.setSpinProfile('sonic');
        this.isIntroActive = false;
        this.introDone = true;
        this.activeRush = null;
        this.independentJet = null;
        this.activeBeat = null;
    }

    isAttacking() { return Boolean(this.robotMove) || super.isAttacking(); }
    isBusy() { return Boolean(this.robotMove) || super.isBusy(); }

    unlockShieldCopy() { this.shieldCopyEnabled = true; this.copyShieldHealth = 36; }

    unlockRockCopy() {
        this.unlockShieldCopy();
        Object.assign(this, this.rockSize);
        this.y = this.feetY - this.height;
        this.rockCopyEnabled = true;
        initBuster(this, 'rock');
    }
    spendWeaponAmmo() { return true; }
    canUseBuster() { return !this.isBusy() && !this.isHitstunned() && !this.isSpinDashActive && !this.isSpinning; }

    onBusterFired(level, direction) { super.onBusterFired(level, direction); this.busterPoseUntil = combatNow() + 420; }

    startEmerlMove(key) {
        if (!attacks[key] || this.busterCharging || this.isBusy() || this.isHitstunned() || this.isSpinning || this.isSpinDashActive) return false;
        if (key === 'rocket' ? this.isGrounded : key === 'waveKick' && !this.isGrounded) return false;
        const pose = key;
        return beginRobotMove(this, { ...EMERL_FRAMES[pose], ...attacks[key], key: pose, ability: key, frames: EMERL_FRAMES[pose].count }, this.facingDirection || 1);
    }

    onDamageTaken({stagger=true}={}) { if(!stagger)return;
        if (this.lastGuardImpact?.blocked) return;
        this.robotMove = null;
        this.emerlHurtAt = combatNow();
    }

    update(opponentX, self) {
        if (this.rockCopyEnabled) this.syncRockSet(game.p1);
        super.update(opponentX, self);
        const now = combatNow();
        if (this.busterCharging && this.equipAt == null) this.equipAt = now;
        if (!this.busterCharging && now >= (this.busterPoseUntil ?? 0) && this.equipAt != null) {
            this.equipAt = null;
            this.unequipAt = now;
        }
        if (this.robotMove?.spec.key === 'waveKick' && !this.robotMove.wave &&
            combatNow() - this.robotMove.started >= this.robotMove.spec.ms * 2) {
            this.robotMove.wave = true;
            this.launchWave(this.robotMove.direction);
        }
        updateRobotMove(this, true);
    }

    syncRockSet(rock) {
        if (rock?.characterId !== 'rock' || this.weaponSet === rock.weaponSet) return;
        this.busterCharging = false;
        this.robotMove = null;
        this.heatCasting = this.cutShotActive = this.swordCasting = this.slashActive = false;
        this.greenCast = null;
        this.facingLocked = false;
        this.fireEffects = [];
        this.leafShield = null;
        this.snakes = [];
        this.bombs = [];
        super.selectWeaponSet(rock.weaponSet);
    }

    startFlameSword() {
        return this.weaponSet === 'fire' &&
            this.startEmerlMove('sword') && this.spendWeaponAmmo(12);
    }

    tryHit(target) {
        hitRobotMove(this, target);
        if (this.rockCopyEnabled) super.tryHit(target);
    }

    launchWave(direction) {
        game.projectiles.push({
            owner: this, type: 'Onda de Emerl', active: true, damage: 8,
            x: this.x + this.width / 2 + direction * 36 - 55,
            y: this.y + this.height - 103, width: 110, height: 102, vx: direction * 13, age: 0,
            update() { this.x += this.vx; if (++this.age >= 63) this.active = false; },
            frame() {
                return frameFor('wave', Math.min(8, Math.floor(this.age / 7)), this.x + this.width / 2,
                    this.y + this.height, 1.8, direction);
            },
            pixelHitsTarget(target) {
                const frame = this.frame();
                const other = target.getPixelBodyFrame?.(this.x);
                return other ? opaqueFramesOverlap(frame, other) : opaqueInRect(frame, {
                    x: target.x, y: target.getCurrentY(), w: target.width, h: target.getCurrentHeight()
                });
            },
            draw(camera) { drawFrame(this.frame(), camera); }
        });
    }

    getCopyShieldLayers() {
        const now = combatNow();
        if (!this.shieldCopyEnabled || this.weaponSet !== 'base' || this.isBusy() || this.busterCharging || this.equipAt != null ||
            !this.isGrounded || this.isSpinning || this.isSpinDashActive || this.isHitstunned() || now < (this.copyShieldBrokenUntil ?? 0)) return null;
        const guard = this.isGuarding || Boolean(this.keys[this.controls.heavy]);
        const count = guard ? 5 : 9;
        const walking = Math.abs(this.vx) > .1;
        const index = walking ? Math.floor(now / 82) % count : 0;
        return shieldLayers(guard, index, this.x + this.width / 2, this.y + this.height,
            this.emerlSpriteHeight / 39, this.facingDirection);
    }

    shieldIntersects(rect) { return shieldIntersects(this.getCopyShieldLayers(), rect); }

    absorbCopyShield(damage, options) {
        const rect = options.hitRect || (Number.isFinite(options.impactX) && Number.isFinite(options.impactY)
            ? { x: options.impactX - 4, y: options.impactY - 4, w: 8, h: 8 } : null);
        if (!rect || !this.shieldIntersects(rect)) return damage;
        const remaining = Math.max(0, damage - this.copyShieldHealth);
        this.copyShieldHealth = Math.max(0, this.copyShieldHealth - damage);
        if (!this.copyShieldHealth) {
            this.copyShieldBrokenUntil = combatNow() + 1800;
            this.copyShieldHealth = 36;
        }
        return remaining;
    }

    getPixelBodyFrame() {
        const shield = this.getCopyShieldLayers();
        if (shield) return shield.body;
        const now = combatNow();
        let key = 'idle', elapsed = now, index;
        if (this.wasInAirFromKnockback) { key = 'hardHurt'; elapsed = now - (this.emerlHurtAt ?? now); }
        else if (now - (this.emerlHurtAt ?? -Infinity) < 210) { key = 'hurt'; elapsed = now - this.emerlHurtAt; }
        else if (this.robotMove) { key = this.robotMove.spec.key; elapsed = now - this.robotMove.started; }
        else if (this.isSpinDashActive) key = 'spin';
        else if (this.isSpinning) key = 'spinCharge';
        else if (this.cutShotActive || this.heatCasting || this.greenCast || this.slashActive) {
            key = 'punch'; elapsed = now - (this.cutShotActive ? this.cutShotStartedAt : this.heatCasting ? this.heatCastAt : this.greenCast?.at ?? this.slashStartedAt);
        }
        else if (this.equipAt != null) {
            if (now - this.equipAt < 7 * EMERL_FRAMES.equip.ms) { key = 'equip'; elapsed = now - this.equipAt; }
            else if (!this.isGrounded) { key = 'busterAir'; index = Math.max(0, Math.min(4, Math.floor((this.vy + 12) / 5))); }
            else { key = 'busterWalk'; if (Math.abs(this.vx) < 1) index = 0; }
        } else if (now - (this.unequipAt ?? -Infinity) < 7 * EMERL_FRAMES.unequip.ms) {
            key = 'unequip'; elapsed = now - this.unequipAt;
        } else if (!this.isGrounded && this.vy >= 2) {
            key = 'fall'; index = Math.min(3, Math.floor(this.vy / 4));
        } else if (!this.isGrounded) {
            key = 'jump';
            index = this.vy < -8 ? 0 : this.vy < -3 ? 1 : this.vy < 2 ? 2 : this.vy < 8 ? 3 : 4;
        } else if (this.isGuarding) key = 'guard';
        else if (Math.abs(this.vx) > 1) key = 'run';
        const info = EMERL_FRAMES[key];
        const tick = Math.max(0, Math.floor(elapsed / info.ms));
        index ??= this.robotMove || key === 'hurt' || key === 'hardHurt'
            ? Math.min(info.count - 1, tick) : tick % info.count;
        return frameFor(key, index, this.x + this.width / 2, this.y + this.height, this.emerlSpriteHeight / 39,
            this.robotMove?.direction ?? this.facingDirection ?? 1);
    }

    pixelBodyIntersectsRect(rect) { return opaqueInRect(this.getPixelBodyFrame(), rect, 2); }
    draw(opponentX) {
        const frame = this.getPixelBodyFrame();
        this.activeRush?.draw();
        this.independentJet?.draw();
        this.activeBeat?.draw();
        for (const item of [...this.eddies, ...this.eddieSupplies, ...this.beatBoxes]) item.draw();
        for (const concrete of this.concretes) concrete.draw(game.cameraX);
        for (const effect of [...this.fireEffects, ...this.bombs, ...this.snakes]) effect.draw();
        let mode = ({ cut_concrete: 'cut', fire: 'fire', leaf_snake: 'leaf' })[this.weaponSet];
        if (frame && this.busterCharging) {
            const level = getBusterLevel(this);
            const charge = Math.floor(combatNow() / 95) % 2 ? 2 : level === 1 ? 0 : level === 2 ? 1 : 3;
            if (charge) mode = 'charge' + charge;
            ctx.save();
            ctx.globalAlpha = .18 + .1 * getBusterLevel(this);
            ctx.strokeStyle = '#9eefff';
            ctx.lineWidth = 2;
            const center = Math.round(this.x + this.width / 2 - game.cameraX);
            const radius = 22 + Math.floor(combatNow() / 35) % 12;
            ctx.strokeRect(center - radius, this.y + this.height * .45 - radius, radius * 2, radius * 2);
            ctx.restore();
        }
        const shield = this.getCopyShieldLayers();
        if (shield?.behind) drawFrame(shield.shield, game.cameraX);
        if (frame) drawFrame(copyPalette(frame, mode), game.cameraX);
        if (shield && !shield.behind) drawFrame(shield.shield, game.cameraX);
        if (!frame) super.draw(opponentX);
        this.leafShield?.draw();
        if (this.robotMove?.spec.key === 'sword' && frame) {
            const index = Math.min(3, Math.floor((combatNow() - this.robotMove.started) / EMERL_FRAMES.sword.ms));
            drawFrame({ ...frame, sx: index * 72, sy: EMERL_FRAMES.swordFx.row * 64 }, game.cameraX);
        }
    }
}

const names = {
    idle: 'Reposo', run: 'Carrera', jump: 'Salto y caída', guard: 'Guardia',
    hurt: 'Golpe recibido', hardHurt: 'Golpe fuerte recibido', spin: 'Spin Dash', spinCharge: 'Carga de Spin Dash',
    upper: 'Patada alta', waveKick: 'Patada de onda', punch: 'Puño', rocket: 'Patada Rocket',
    roundhouse: 'Patada giratoria', wave: 'Onda', fall: 'Caída', equip: 'Sacar Buster', unequip: 'Guardar Buster', busterWalk: 'Caminar con Buster', busterAir: 'Buster en el aire', sword: 'Flame Sword · cuerpo', swordFx: 'Flame Sword · efecto'
};
export function emerlAnimations() {
    return [...Object.entries(EMERL_FRAMES).map(([key, { count, ms }]) => ({
        id: key, name: names[key], count, ms, frame: index => frameFor(key, index, 0, 0, 1, 1)
    })), ...copyShieldAnimations()];
}
