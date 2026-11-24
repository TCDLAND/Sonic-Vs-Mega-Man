import { updatedCells, updatedFrame } from './fighter-update-art.js';
import { drawRobotFrame } from './robot-sprites.js';
import { combatNow } from './combat-clock.js';
import { configureCombatant, dealDamage } from './combat-system.js';
// ========================================
// CLASE ESPIO
// ========================================

import { Fighter } from './fighter.js';
import { ctx, game } from './state.js';
import { espioSprite3 } from './assets.js';
import { getCellCoords } from './utils.js';
import { HIGHWAY_WALLS } from './wall-system.js';

const ninjaShots = {
    kunai: { images:updatedCells('espio-kingnoel','kunaiShot'), width:34, height:44 },
    shuriken: { images:updatedCells('espio-kingnoel','shurikenShot'), width:58, height:40 }
};

export class Espio extends Fighter {
    constructor(x, y, controls) {
        super(x, y, '#0055ff', controls, true);
        configureCombatant(this, 'espio', 'ESPIO');
        this.supportsSpin = true;
        this.setSpinProfile('espio');
        this.isSprite = true;
    }

    projectileProfile(kind) { return ninjaShots[kind]; }

    getTongueCells() {
        if (this.tongueType === "forward") {
            if (this.tonguePhase === "pose" || this.tonguePhase === "retract") {
                return [{ frameNum: 3, offsetCol: 0, offsetRow: 0, isDamageCell: false }];
            }
            return [
                { frameNum: 4, offsetCol: 0, offsetRow: 0, isDamageCell: false },
                { frameNum: 5, offsetCol: 1, offsetRow: 0, isDamageCell: true },
                { frameNum: 6, offsetCol: 2, offsetRow: 0, isDamageCell: true }
            ];
        } else {
            if (this.tonguePhase === "pose" || this.tonguePhase === "retract") {
                return [{ frameNum: 0, offsetCol: 0, offsetRow: 0, isDamageCell: false }];
            }
            return [
                { frameNum: 1, offsetCol: 0, offsetRow: -1, isDamageCell: true },
                { frameNum: 2, offsetCol: 1, offsetRow: -1, isDamageCell: true },
                { frameNum: 9, offsetCol: 0, offsetRow: 0, isDamageCell: false },
                { frameNum: 10, offsetCol: 1, offsetRow: 0, isDamageCell: true }
            ];
        }
    }

    getTongueRects() {
        if (!espioSprite3.naturalWidth) return [];
        const facingLeft = this.tongueDirection < 0;
        const width=Math.round(this.width), height=Math.round(this.height);
        return this.getTongueCells().map(cell => ({
            ...getCellCoords(cell.frameNum, espioSprite3.naturalWidth, espioSprite3.naturalHeight, 8, 6),
            x: this.x - game.cameraX + cell.offsetCol * width * (facingLeft ? -1 : 1),
            y: this.y + cell.offsetRow * height,
            w: width, h: height, facingLeft, isDamageCell: cell.isDamageCell
        }));
    }

    startNinjaTechnique(kind, target) {
        const now = combatNow();
        if (!['smoke','drill','tornado'].includes(kind) || !target || !this.isGrounded || this.isBusy() ||
            this.isHitstunned() || this.isVulnerable || now < (this.ninjaReadyAt ?? 0)) return false;
        this.ninja = { kind, target, started: now, direction: target.x >= this.x ? 1 : -1 };
        this.ninjaReadyAt = now + 850;
        this.vx = 0;
        return true;
    }

    isBusy() { return !!this.ninja || super.isBusy(); }
    isAttacking() { return !!this.ninja || super.isAttacking(); }

    update(opponentX, instance) {
        const move = this.ninja;
        if (move && this.isHitstunned()) this.ninja = null;
        if (this.ninja) this.vx = 0;
        super.update(opponentX, instance);
        if (!this.ninja) return;
        const age = combatNow() - move.started;
        if (age >= 650) { this.ninja = null; return; }
        if (move.kind === 'drill' && age >= 145 && age < 480) {
            this.x = Math.max(HIGHWAY_WALLS[0].x,Math.min(HIGHWAY_WALLS[1].x-this.width,
                this.x+move.direction*9));
        }
        if (move.kind === 'smoke' && !move.crossed && age >= 240) {
            const target = move.target;
            const side = this.x < target.x ? 1 : -1;
            const desired = side > 0 ? target.x + target.width + 24 : target.x - this.width - 24;
            const left = HIGHWAY_WALLS[0].x, right = HIGHWAY_WALLS[1].x - this.width;
            const fallback = side > 0 ? target.x - this.width - 24 : target.x + target.width + 24;
            this.x = Math.max(left, Math.min(right, desired < left || desired > right ? fallback : desired));
            move.direction = target.x >= this.x ? 1 : -1;
            if (move.direction === -side) {
                target.smokeTurnUntil = combatNow() + 130;
                target.smokeTurnSource = this;
            }
            move.crossed = true;
        }
    }

    tryHit(target) {
        const move = this.ninja;
        if (!move || move.hit || target !== move.target || target.health <= 0 || this.isHitstunned()) return;
        const age = combatNow() - move.started;
        const dx = target.x + target.width/2 - this.x - this.width/2;
        const dy = Math.abs(target.y + target.height - this.y - this.height);
        const timing = { smoke: [320,460,180,9], drill: [160,485,125,11], tornado: [240,505,175,13] };
        const [start,end,reach,damage] = timing[move.kind];
        if (age < start || age > end || Math.abs(dx) > reach || dy > (move.kind==='tornado'?150:75)) return;
        if (move.kind !== 'tornado' && dx * move.direction < -20) return;
        move.hit = true;
        const names = { smoke:'Corte entre humo', drill:'Trompo ninja', tornado:'Tornado ninja' };
        dealDamage(target,damage,{attacker:this,attackName:names[move.kind],impactX:this.x+this.width/2,
            damageCategory:move.kind==='tornado'?'técnica':'cuerpo a cuerpo'});
        if (move.kind === 'tornado' && !target.lastGuardImpact?.front) {
            target.vy = -10;
            target.isGrounded = false;
        }
    }

    draw(opponentX) {
        const now = combatNow();
        let direction = opponentX < this.x ? -1 : 1;
        if (this.isTongueAttacking) {
            for (const cell of this.getTongueRects()) {
                ctx.save();
                ctx.translate(cell.x + (cell.facingLeft ? cell.w : 0), cell.y);
                if (cell.facingLeft) ctx.scale(-1,1);
                ctx.drawImage(espioSprite3,cell.sx,cell.sy,cell.sw,cell.sh,0,0,cell.w,cell.h);
                ctx.restore();
            }
            return;
        }
        let key = 'idle', index = Math.floor(now/130);
        if (this.ninja) {
            const age = now-this.ninja.started;
            key = this.ninja.kind;
            if (key==='smoke' && this.ninja.crossed) index = Math.max(0,3-Math.floor((age-240)/90));
            else if (key==='drill') index=Math.floor(age/54);
            else index=Math.min(key==='tornado'?5:3,Math.floor(age/95));
            direction=this.ninja.direction;
        } else if (this.isThrowingKunai) {
            key='kunai'; index=Math.min(4,Math.floor(this.kunaiTimer/4));
        } else if (this.isThrowingShuriken) {
            key='shuriken'; index=Math.min(5,Math.floor(this.shurikenTimer/4));
        } else if (this.isSpinDashActive || this.isSpinning) {
            key='spin'; index=Math.floor(this.spinAnimFrame);
        } else if (this.isJabActive) {
            key='jab'; index=Math.min(2,Math.floor(this.jabTimer/3));
        } else if (this.isHeavyActive) {
            key='heavy'; index=Math.min(4,Math.max(0,this.heavyFrame-1));
        } else if (this.isKickLightActive) {
            key='kick'; index=Math.floor(now/65);
        } else if (this.isKickHeavyActive) {
            key='upper'; index=Math.min(3,Math.floor(this.kickHeavyTimer/4));
        } else if (this.isGuarding) {
            key='guard'; index=this.lastGuardImpact?.blocked && now-this.lastGuardImpact.at<160 ? 2 : 0;
        } else if (this.isCrouching) {
            key='crouch'; index=0;
        } else if (this.isDashing) {
            key='dash'; index=Math.floor(now/60);
        } else if (!this.isGrounded) {
            key=this.vy<0?'jump':'fall'; index=Math.floor(now/90);
        } else if (Math.abs(this.vx)>.5) {
            key='run'; index=Math.floor(now/77);
        }

        const frame = updatedFrame('espio-kingnoel',key,index,this.x+this.width/2,this.y+this.height,this.height/42,direction);
        if (!frame) return;
        ctx.save();
        if (this.isVulnerable && Math.floor(now/100)%2===0) ctx.globalAlpha=.55;
        drawRobotFrame(ctx,frame,game.cameraX);
        ctx.restore();
    }
}
