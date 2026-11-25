import { HIGHWAY_WALLS } from './wall-system.js';
import { matchupFor } from './matchup-plans.js';
import { requestTeamAssist, teamAssistSlots } from './team-assists.js';
import { startSonicMove } from './sonic-battle-kit.js';
import { silverShotKind } from './silver.js';
import { combatNow } from './combat-clock.js';
import { game } from './state.js';
import { BusterProjectile, getBusterLevel } from './buster-system.js';

// Preferred interception distance and approach for an opponent that can hold altitude.
const AIR_MATCHUPS = {
    espio:[275,'projectile'], bass:[345,'bass'], sonic:[235,'sonic'], shadow:[340,'shadow'],
    knuckles:[155,'knuckles'], silver:[315,'silver'], x:[325,'buster'], zero:[195,'zero'],
    rock:[260,'coil'], protoman:[330,'buster'], eggman:[285,'flight'], wily:[165,'jump'],
    emerl:[205,'emerl'], 'megaman-zero':[215,'mmzero'], 'metal-sonic':[255,'metal'],
    tails:[215,'tails'], chaos:[215,'chaos']
};

const STORAGE_KEY = 'sonic-vs-megaman-cpu-learning-v1';
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function defaultProfile() {
    return {
        scores: { approach: 0, guard: 0, jab: 0, heavy: 0, kick: 0, spin: 0, chaos: 0, magic: 0, roam: 0, teleport: 0, bass_shot: 0, bass_diagonal: 0, treble: 0, treble_bison: 0, knuckles_miner: 0, knuckles_grab: 0, rock_concrete: 0, rock_cutter: 0, rock_claw: 0, rock_fire: 0, buster: 0, brake: 0, sonic_rocket: 0 },
        wins: 0, losses: 0, draws: 0, hits: 0, blocks: 0, matches: 0, penalties: 0
    };
}

function readProfile(storageKey) {
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (!saved || typeof saved !== 'object') return defaultProfile();
        return { ...defaultProfile(), ...saved, scores: { ...defaultProfile().scores, ...saved.scores } };
    } catch {
        return defaultProfile();
    }
}

function hasIncomingProjectile(player, defender) {
    const projectiles = [...(game.projectiles || []), ...(game.bassBullets || []), ...(game.trebleBullets || []),
        ...(player.fireEffects??[]).filter(effect=>effect.kind==='shot'||effect.kind==='heat')];
    const defenderCenterX = defender.x + defender.width / 2;
    const defenderCenterY = defender.getCurrentY() + defender.getCurrentHeight() / 2;
    return projectiles.some((projectile) => {
        if (!projectile.active || projectile.collisionDisabled || projectile.effectActive || projectile.owner !== player) return false;
        const vx = projectile.vx ?? (Number.isFinite(projectile.prevX)?projectile.x-projectile.prevX:(projectile.direction??0)*10);
        const vy = projectile.type==='rock-fire-shot'?0:projectile.vy??0;
        const projectileCenterX = projectile.x + (projectile.width || 0) / 2;
        const projectileCenterY = projectile.y + (projectile.height || 0) / 2;
        const dx = defenderCenterX - projectileCenterX;
        const dy=defenderCenterY-projectileCenterY;
        if (Math.abs(dx)>330 || Math.abs(dy)>240) return false;
        if (vx===0) return Math.abs(dx)<defender.width*.55 && dy*vy>0 && Math.abs(dy)<185;
        const frames=dx/vx;
        return frames>=0 && frames<=34 && Math.abs(dy-vy*Math.min(frames,10))<=165;
    });
}

function hasNearIncomingAttack(player, defender, distance) {
    if (distance > 350 || !player?.isAttacking?.()) return false;
    const dx = (defender.x + defender.width / 2) - (player.x + player.width / 2);
    const direction = player.facingDirection || (player.characterId === 'bass' ? (player.facingLeft ? -1 : 1) : Math.sign(dx));
    return dx * direction > 0;
}

function hasIncomingGroundThreat(player, defender) {
    const centerX = defender.x + defender.width / 2;
    const threats = [...(player.snakes || []), ...(player.bombs || [])];
    return threats.some((threat) => {
        if (!threat.active || threat.hit || threat.blast || threat.climbing) return false;
        const dx = centerX - threat.x;
        return Math.abs(dx) < 290 && Math.abs((defender.y + defender.height) - threat.y) < 120 && dx * (threat.dir || threat.vx || 0) >= 0;
    });
}

export class CpuFighter {
    constructor(storageKey = STORAGE_KEY) {
        this.storageKey = storageKey;
        this.profile = storageKey===null?defaultProfile():readProfile(storageKey);
        this.nextDecisionAt = 0;
        this.currentAction = 'approach';
        this.lastAction = null;
        this.actionStreak = 0;
        this.actionCounts = {};
        this.hitsThisMatch = 0;
        this.blocksThisMatch = 0;
        this.repeatPenalties = 0;
        this.lastHitAt = 0;
        this.lastRewardText = 'Ajustando estrategia';
        this.randomSeed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
        this.spinPlan = null;
        this.spinCooldownUntil = 0;
        this.shadowMagicPlan = false;
        this.shadowSpecialCooldownUntil = 0;
        this.shadowSpecialChoice = 0;
        this.guardReactionAt = 0;
        this.guardHoldUntil = 0;
        this.guardNextAt = 0;
        this.guardCounter = 0;
        this.characterCooldownUntil = 0;
        this.busterCooldownUntil = 0;
        this.rockComboPhase = 'idle';
        this.rockComboAt = 0;
        this.rockConcreteRef = null;
    }

    random() {
        this.randomSeed = (1664525 * this.randomSeed + 1013904223) >>> 0;
        return this.randomSeed / 0x100000000;
    }

    save() {
        if(this.storageKey===null)return;
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.profile)); } catch { /* storage may be disabled */ }
    }

    setMovement(fighter, left, right, crouch = false, jump = false) {
        fighter.keys[fighter.controls.left] = left;
        fighter.keys[fighter.controls.right] = right;
        fighter.keys[fighter.controls.crouch] = crouch;
        fighter.keys[fighter.controls.jump] = jump;
    }

    reward(action, amount, reason) {
        if (!action || !(action in this.profile.scores)) return;
        this.profile.scores[action] = clamp(this.profile.scores[action] + amount, -8, 12);
        this.lastRewardText = reason;
        this.save();
    }

    chooseMove(distance) {
        const candidates = [
            { id: 'jab', base: distance < 105 ? .62 : distance < 175 ? .24 : .03 },
            { id: 'heavy', base: distance < 155 ? .42 : .12 },
            { id: 'kick', base: distance < 175 ? .34 : .10 },
            { id: 'spin', base: distance >= 135 && distance <= 310 ? .40 : .035 },
        ];
        let total = 0;
        for (const move of candidates) {
            const repeatCost = move.id === this.lastAction ? Math.min(.65, this.actionStreak * .18) : 0;
            move.weight = Math.max(.04, move.base * (this.matchupPlan?.[move.id]??1) * Math.exp(clamp(this.profile.scores[move.id] * .12 - repeatCost, -1.4, 1.4)));
            total += move.weight;
        }
        let roll = this.random() * total;
        return candidates.find((move) => (roll -= move.weight) <= 0)?.id || 'jab';
    }

    act(action, fighter, now) {
        if (action === this.lastAction) this.actionStreak++;
        else { this.lastAction = action; this.actionStreak = 1; }
        this.currentAction = action;
        this.actionCounts[action] = (this.actionCounts[action] || 0) + 1;

        if (action === 'approach') return;
        if (action === 'guard') return;

        if (fighter.characterId === 'shadow' && action === 'heavy') {
            fighter.startShadowSlider();
            return;
        }
        if (fighter.characterId === 'shadow' && action === 'kick') {
            fighter.startChaosUpper();
            return;
        }

        if (action === 'spin' && fighter.supportsSpin && !this.spinPlan) {
            this.spinPlan = { target: fighter.characterId === 'knuckles' ? 1 : 2, started: now };
            this.setMovement(fighter, false, false, true);
            return;
        }

        const keyByAction = {
            jab: fighter.controls.attack,
            heavy: fighter.controls.heavy,
            kick: fighter.controls.kickLight,
            spin: fighter.controls.spinKey
        };
        const code = keyByAction[action];
        if (!code) return;
        window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
        window.setTimeout(() => {
            const stillControls = (game.p1 === fighter && game.cpuAgentP1 === this) ||
                (game.p2 === fighter && game.cpuAgentP2 === this);
            if (stillControls && !game.paused) window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
        }, 90);
    }

    recordAction(action) {
        if (this.lastAction === action) this.actionStreak++;
        else { this.lastAction = action; this.actionStreak = 1; }
        this.currentAction = action;
        this.actionCounts[action] = (this.actionCounts[action] || 0) + 1;
    }

    runCharacterPlan(player, cpu, distance, towardRight, now) {
        const toward = towardRight ? cpu.controls.right : cpu.controls.left;
        const away = towardRight ? cpu.controls.left : cpu.controls.right;
        const wait = (ms) => { this.characterCooldownUntil = now + ms; };

        if (cpu.characterId === 'bass') {
            const treble = cpu.activeTreble;
            if ((!treble || !treble.isActive) && cpu.trebleCooldown <= 0 && now >= this.characterCooldownUntil) {
                cpu.summonTreble(player.x); this.recordAction('treble'); wait(900); return true;
            }
            if (treble?.isActive && treble.state === 'attack_bison') return true;
            if (treble?.isActive && treble.state === 'following' && now >= this.characterCooldownUntil) {
                const rivalAbove = !player.isGrounded && player.getCurrentY() + player.getCurrentHeight() * .65 < cpu.getCurrentY() + cpu.getCurrentHeight() * .55;
                if ((rivalAbove && distance < 820) || (distance >= 260 && distance < 560 && this.random() < .66)) {
                    treble.startBison(); this.recordAction('treble_bison'); wait(2400); return true;
                }
                if (distance > 680) treble.startShot(true);
                else if (distance > 320 && this.random() < .58) treble.startShot(false);
                else treble.startRush();
                this.recordAction('treble'); wait(1250); return true;
            }
            if ((cpu.state === 'idle' || cpu.state === 'walk') && now >= this.characterCooldownUntil) {
                if (distance < 230) this.setMovement(cpu, away === cpu.controls.left, away === cpu.controls.right, false);
                else if (distance > 680) this.setMovement(cpu, toward === cpu.controls.left, toward === cpu.controls.right, false);
                else this.setMovement(cpu, false, false, false);
                if (distance <= 950) {
                    const rivalAbove = !player.isGrounded && player.getCurrentY() + player.getCurrentHeight() * .7 < cpu.getCurrentY() + cpu.getCurrentHeight() * .55;
                    if (rivalAbove) {
                        if (cpu.tryShoot('up', 'forward')) {
                            this.recordAction('bass_diagonal'); wait(1450); return true;
                        }
                    }
                    if (distance >= 220 && !rivalAbove && player.minerPhase !== 'under' &&
                        !player.busterCharging && cpu.tryShoot('neutral', 'neutral')) {
                        this.recordAction('bass_shot'); wait(1450); return true;
                    }
                }
                if (distance < 220 && cpu.isGrounded) {
                    cpu.tryDash(away === cpu.controls.right ? 'right' : 'left');
                    cpu.tryDash(away === cpu.controls.right ? 'right' : 'left');
                    this.recordAction('approach'); wait(1200); return true;
                }
            }
            return true;
        }

        if (cpu.characterId === 'knuckles') {
            if (cpu.minerPhase === 'under') {
                const closeEnough = distance < Math.max(95, cpu.width * .65);
                cpu.facingDirection = towardRight ? 1 : -1;
                this.setMovement(cpu, !closeEnough && toward === cpu.controls.left, !closeEnough && toward === cpu.controls.right, false);
                if (closeEnough || now - cpu.undergroundStart > 2900) {
                    cpu.beginMinerExit(); this.recordAction('knuckles_miner'); wait(2100);
                }
                return true;
            }
            if (player.characterId === 'bass' && distance > 175 && distance < 720 &&
                now >= this.characterCooldownUntil && cpu.startMiner()) {
                this.recordAction('knuckles_miner'); wait(1200); return true;
            }
            if (distance > 300) { this.setMovement(cpu, toward === cpu.controls.left, toward === cpu.controls.right, false); return true; }
            this.setMovement(cpu, false, false, false);
            if (now < this.characterCooldownUntil) return true;
            if (!cpu.minerPhase && cpu.isGrounded && distance > 80 && distance < 300 && this.random() < .46 && cpu.startMiner()) {
                this.recordAction('knuckles_miner'); wait(2300); return true;
            }
            if (cpu.isGrounded && distance < cpu.width * .88 && (player.isGuarding || this.random() < .4) && cpu.startGrab()) {
                this.recordAction('knuckles_grab'); wait(1500); return true;
            }
            if (!player.isGrounded && distance < 220 && cpu.startUpper()) { this.recordAction('kick'); wait(1000); return true; }
            if (distance < 120 && cpu.startPunch2()) { this.recordAction('heavy'); wait(700); return true; }
            if (distance < 260 && player.isGrounded && cpu.startFloorPunch()) { this.recordAction('knuckles_miner'); wait(1200); return true; }
            if (!cpu.isGrounded && !cpu.glide && distance < 260) cpu.startGlide(cpu.facingDirection);
            else if (cpu.glide && !cpu.glideAttack && distance < 180) cpu.attackFromGlide();
            return true;
        }

        if (cpu.shieldCopyEnabled && !cpu.rockCopyEnabled && now >= this.characterCooldownUntil) {
            const key = distance < 130 ? (player.isGrounded ? 'roundhouse' : 'upper') : distance < 410 ? 'waveKick' : null;
            if (key && cpu.startEmerlMove(key)) { wait(950); return true; }
        }
        if (cpu.rockCopyEnabled) {
            cpu.syncRockSet(player);
            if (now < this.characterCooldownUntil || cpu.isBusy()) return false;
            const set = cpu.weaponSet;
            let used = false;
            if (set === 'cut_concrete') {
                const fixed = cpu.concretes.some(item => item.active && item.kind !== 'moving');
                used = distance < 300 ? cpu.startRollingCutter(player.isGrounded ? 'lower' : 'upper')
                    : cpu.startConcrete(fixed ? 'moving' : 'build_far');
            } else if (set === 'fire') {
                used = distance < 160 ? cpu.startFlameSword() :
                    distance < 750 && (this.random() < .65 ? cpu.startHeatFire() : cpu.startFireShot());
            } else if (set === 'leaf_snake') {
                used = distance < 255 ? (cpu.leafShield ? cpu.launchLeaf() : cpu.startGreen('leaf'))
                    : distance < 780 && cpu.startGreen(this.random() < .25 ? 'bomb' : 'snake');
            } else if (distance < 130) used = cpu.startEmerlMove('punch');
            if (used) { wait(780); return true; }
        }
        if (cpu.characterId === 'rock' && player.characterId === 'wily') {
            const master=player.robotId||'cut';
            const dir=towardRight?1:-1;
            const airborne=!player.isGrounded;
            const attack=(started,name,cooldown)=>{
                if(!started)return false;
                this.recordAction(name);wait(cooldown);return true;
            };
            if (now < this.characterCooldownUntil) {
                const preferred=master==='guts'?330:master==='heat'?245:195;
                const advance=distance>preferred+80,retreat=distance<preferred-75;
                this.setMovement(cpu,advance&&dir<0||retreat&&dir>0,advance&&dir>0||retreat&&dir<0,
                    false,cpu.isGrounded&&hasIncomingProjectile(player,cpu)&&this.random()<.16);
                return true;
            }
            if (cpu.isBusy()) return true;
            let used=false;
            if (master==='cut') {
                if (distance<125 && cpu.isGrounded) {
                    if(cpu.weaponSet!=='fire')cpu.selectWeaponSet('fire');
                    used=attack(airborne?cpu.startFlameSword():cpu.startSlashClaw(),
                        airborne?'rock_fire':'rock_claw',airborne?1450:620);
                } else if(distance<365&&cpu.weaponAmmo?.cut_concrete>10) {
                    if(cpu.weaponSet!=='cut_concrete')cpu.selectWeaponSet('cut_concrete');
                    used=attack(cpu.startRollingCutter(airborne?'upper':'lower'),'rock_cutter',920);
                } else if(distance<820&&cpu.weaponAmmo?.fire>2) {
                    if(cpu.weaponSet!=='fire')cpu.selectWeaponSet('fire');
                    used=attack(cpu.startFireShot(),'rock_fire',520);
                }
            } else if (master==='guts') {
                if(distance<155&&cpu.isGrounded) {
                    if(cpu.weaponSet!=='fire')cpu.selectWeaponSet('fire');
                    used=attack(cpu.startFlameSword(),'rock_fire',1450);
                    if(!used)used=attack(cpu.startSlashClaw(),'rock_claw',620);
                } else if(distance<390&&cpu.weaponAmmo?.fire>=14&&this.random()<.42) {
                    if(cpu.weaponSet!=='fire')cpu.selectWeaponSet('fire');
                    used=attack(cpu.startHeatFire(),'rock_fire',1550);
                } else if(distance<850&&cpu.weaponAmmo?.fire>2) {
                    if(cpu.weaponSet!=='fire')cpu.selectWeaponSet('fire');
                    used=attack(cpu.startFireShot(),'rock_fire',540);
                }
            } else {
                if(distance<145&&cpu.isGrounded) {
                    used=attack(cpu.startSlashClaw(),'rock_claw',620);
                } else if(distance<440&&cpu.weaponAmmo?.cut_concrete>10) {
                    if(cpu.weaponSet!=='cut_concrete')cpu.selectWeaponSet('cut_concrete');
                    used=attack(cpu.startRollingCutter(airborne?'upper':'lower'),'rock_cutter',920);
                } else if(distance<800&&cpu.weaponAmmo?.leaf_snake>=8) {
                    if(cpu.weaponSet!=='leaf_snake')cpu.selectWeaponSet('leaf_snake');
                    used=attack(cpu.startGreen('snake'),'rock_fire',1150);
                }
            }
            if(used){this.setMovement(cpu,false,false,false);return true;}
            const preferred=master==='guts'?330:master==='heat'?245:195;
            const advance=distance>preferred+80,retreat=distance<preferred-75;
            this.setMovement(cpu,advance&&dir<0||retreat&&dir>0,advance&&dir>0||retreat&&dir<0,
                false,cpu.isGrounded&&distance>preferred+220&&this.random()<.035);
            return true;
        }
        if (cpu.characterId === 'rock') {
            if (player.characterId === 'rock') {
                const from = cpu.x + cpu.width / 2;
                const to = player.x + player.width / 2;
                const blocked = distance > 115 && [cpu, player].some(rock => rock.concretes.some(block => {
                    if (!block.active || block.kind === 'moving' || !block.isPlatform?.()) return false;
                    const rect = block.platformRect;
                    return rect.x < Math.max(from,to) && rect.x + rect.w > Math.min(from,to) &&
                        rect.y < cpu.y + cpu.height - 8;
                }));
                if (blocked) {
                    if (cpu.isGrounded && !cpu.isBusy() && now >= this.characterCooldownUntil && cpu.startRushCoil()) {
                        this.recordAction('rush_coil');
                        wait(1050);
                    }
                    this.setMovement(cpu, !towardRight, towardRight, false, cpu.isGrounded && !cpu.isBusy());
                    return true;
                }
            }
            if (player.characterId === 'bass' && !cpu.isGrounded && distance < 360 &&
                cpu.activeRush?.lastCommand === 'coil' && now < this.characterCooldownUntil) {
                cpu.selectWeaponSet('cut_concrete');
                if (cpu.startRollingCutter('lower')) { this.recordAction('rock_concrete'); return true; }
            }
            if (player.characterId === 'bass' && now >= this.characterCooldownUntil) {
                if (distance < 230 && cpu.startRushCoil()) {
                    this.setMovement(cpu, !towardRight, towardRight, false, true);
                    wait(1700); return true;
                }
                if (distance > 350 && cpu.activeBeat?.state === 'follow' && cpu.startBeatPatrol()) {
                    cpu.requestBeatDrop(); wait(2200); return true;
                }
                if (distance > 450 && cpu.startRushJet(towardRight ? 1 : -1)) {
                    wait(2400); return true;
                }
                if (distance > 300 && !cpu.concretes.some(item => item.active && item.kind !== 'moving') &&
                    cpu.weaponAmmo?.cut_concrete >= 22) {
                    cpu.selectWeaponSet('cut_concrete');
                    if (cpu.startConcrete('build_far')) { wait(850); return true; }
                }
            }
            if (now < this.characterCooldownUntil) {
                const dir = towardRight ? 1 : -1;
                const retreat = distance < 170;
                this.setMovement(cpu, (distance > 300 && dir < 0) || (retreat && dir > 0),
                    (distance > 300 && dir > 0) || (retreat && dir < 0), false);
                return true;
            }
            const platform = player.characterId !== 'rock' && cpu.concretes.find((item) => item.active && item.isPlatform?.() && item.kind !== 'moving');
            if (platform) {
                const r = platform.platformRect;
                const onPlatform = Math.abs(cpu.y + cpu.height - r.y) < 18 && cpu.x + cpu.width > r.x && cpu.x < r.x + r.w;
                const targetX = r.x + r.w / 2 - cpu.width / 2;
                if (!onPlatform) {
                    const dir = targetX > cpu.x ? 1 : -1;
                    this.setMovement(cpu, dir < 0, dir > 0, false, cpu.isGrounded && Math.abs(targetX - cpu.x) < 260);
                    return true;
                }
                if (player.characterId === 'bass' && this.chargeBusterAgainstBass(cpu, player, now)) return true;
            }
            if (cpu.activeBeat?.state === 'eddie_carry' && cpu.releaseEddie()) {
                this.recordAction('rock_fire'); wait(850); return true;
            }
            if (cpu.activeBeat?.state === 'follow' && !cpu.eddies.some((eddie) => eddie.active) &&
                now >= cpu.eddieCooldownUntil && distance > 360 && distance < 850 && cpu.isGrounded &&
                !player.isAttacking?.() && !hasIncomingProjectile(player, cpu)) {
                if (cpu.requestEddie()) { this.recordAction('rock_fire'); wait(650); return true; }
            }
            if (cpu.activeBeat?.state === 'follow' && !player.isGrounded && distance < 760 && cpu.startBeatCrescent()) {
                this.recordAction('rock_fire'); wait(1300); return true;
            }
            if (cpu.activeBeat?.state === 'follow' && distance > 600 && now >= this.characterCooldownUntil && cpu.startBeatPatrol()) {
                cpu.requestBeatDrop(); this.recordAction('rock_fire'); wait(2200); return true;
            }
            if (distance > 820 && cpu.independentJet?.state === 'idle' && now >= this.characterCooldownUntil) {
                cpu.startRushJet(towardRight ? 1 : -1); wait(2400); return true;
            }
            if (player.characterId === 'bass' && distance > 235 && distance < 950 &&
                this.chargeBusterAgainstBass(cpu, player, now)) return true;
            if (distance < 180 && cpu.weaponAmmo?.cut_concrete > 10) {
                if (cpu.weaponSet !== 'cut_concrete') cpu.selectWeaponSet('cut_concrete');
                if (cpu.startRollingCutter(player.y < cpu.y - 25 ? 'upper' : 'lower')) { this.recordAction('rock_concrete'); wait(1100); return true; }
            }
            if (!player.isGrounded && distance < 285 && cpu.weaponAmmo?.fire >= 12 && now >= this.characterCooldownUntil) {
                if (cpu.weaponSet !== 'fire') cpu.selectWeaponSet('fire');
                if (cpu.startFlameSword()) { this.recordAction('rock_fire'); wait(1500); return true; }
            }
            if (distance >= 180 && distance <= 720 && cpu.weaponAmmo?.cut_concrete >= 22 && now >= this.characterCooldownUntil) {
                if (cpu.weaponSet !== 'cut_concrete') cpu.selectWeaponSet('cut_concrete');
                const fixed = cpu.concretes.find((item) => item.active && item.kind === 'build_far' && item.state === 'solid');
                if (!fixed) {
                    if (cpu.startConcrete('build_far')) { this.rockConcreteRef = cpu.concretes.at(-1); this.rockComboPhase = 'waiting'; this.recordAction('rock_concrete'); wait(900); }
                    return true;
                }
                const moving = cpu.concretes.some((item) => item.active && item.kind === 'moving');
                if (!moving && cpu.startConcrete('moving')) { this.rockComboPhase = 'idle'; this.recordAction('rock_concrete'); wait(1600); return true; }
            }
            if (distance > 360 && cpu.weaponAmmo?.fire > 18 && now >= this.characterCooldownUntil) {
                if (cpu.weaponSet !== 'fire') cpu.selectWeaponSet('fire');
                if (this.random() < .5 && cpu.startHeatFire()) { this.recordAction('rock_fire'); wait(1700); return true; }
                if (cpu.startFireShot()) { this.recordAction('rock_fire'); wait(450); return true; }
            }
            if (distance >= 220 && distance < 520 && player.isGrounded && cpu.weaponAmmo?.leaf_snake > 10 && now >= this.characterCooldownUntil) {
                if (cpu.weaponSet !== 'leaf_snake') cpu.selectWeaponSet('leaf_snake');
                if (cpu.startGreen('snake')) { this.recordAction('rock_fire'); wait(1250); return true; }
            }
            if (distance < 210 && player.isGrounded && cpu.weaponAmmo?.leaf_snake > 12 && now >= this.characterCooldownUntil) {
                if (cpu.weaponSet !== 'leaf_snake') cpu.selectWeaponSet('leaf_snake');
                if (!cpu.leafShield && cpu.startGreen('leaf')) { this.recordAction('rock_fire'); wait(1200); return true; }
                if (cpu.leafShield && !cpu.leafShield.thrown && cpu.launchLeaf(towardRight ? 1 : -1, 0)) { this.recordAction('rock_fire'); wait(1200); return true; }
                if (cpu.startGreen('bomb')) { this.recordAction('rock_fire'); wait(1200); return true; }
            }
            const direction = towardRight ? 1 : -1;
            if (distance < 170 && cpu.isGrounded && now >= this.characterCooldownUntil && this.random() < .3 && cpu.startSlashClaw()) {
                this.recordAction('heavy'); wait(650); return true;
            }
            if (distance > 330) {
                    this.setMovement(cpu, direction < 0, direction > 0, false, cpu.isGrounded && distance > 620 && this.random() < .035);
            } else if (distance < 125) {
                this.setMovement(cpu, direction > 0, direction < 0, false, cpu.isGrounded && this.random() < .025);
            } else {
                const strafe = Math.sin(now / 520 + cpu.x) > .45;
                this.setMovement(cpu, strafe && direction > 0, strafe && direction < 0, false);
            }
            return true;
        }

        if (cpu.characterId==='wily') {
            if (cpu.isHitstunned() || cpu.isVulnerable) return true;
            const active=cpu.robotId;
            if (cpu.units[active]<16 && cpu.rotateMaster()) cpu.toggleRepair();
            const airborne=!player.isGrounded;
            this.setMovement(cpu,distance>260&&!towardRight,distance>260&&towardRight,false,distance<280&&airborne);
            if(now<this.characterCooldownUntil) return true;
            const attack=cpu.robotId==='guts'?(distance<155?'punch':distance<365?'shoulder':'rock')
                :cpu.robotId==='heat'?(airborne?'airRush':distance<155?'pillar':'fireball')
                :(airborne?'leap':distance<155?'slide':'cutter');
            if(distance<515 && cpu.commandMasterMove(attack,player.x)) wait(900);
            if(distance<570 && !cpu.repairMaster) cpu.callSupport(player,false);
            return true;
        }
        if (cpu.characterId === 'eggman') {
            if (cpu.isBusy()) return true;
            const direction=towardRight?1:-1;
            if (this.refuelEggmobile(cpu)) return true;
            const airborne=!player.isGrounded;
            if (now>=this.characterCooldownUntil) {
                let supportUsed=false;
                if (airborne && distance<620 && !game.eggBuzzer && now>=(cpu.eggBuzzerReadyAt||0)) {
                    supportUsed=cpu.summonBuzzer(player);
                    if(supportUsed)this.recordAction('egg_buzzer');
                } else if (!airborne && distance>230 && distance<720 && !game.eggMotobug && now>=(cpu.eggMotobugReadyAt||0) && this.random()<.20) {
                    supportUsed=cpu.summonMotobug(player);
                    if(supportUsed)this.recordAction('egg_motobug');
                } else if (!cpu.eggPawn || now>=(cpu.eggPawn.orderReadyAt||0)) {
                    const order=distance<210?'drill':distance<510?'weapon':'bomb';
                    supportUsed=cpu.commandEggPawn(order,player);
                    if(supportUsed)this.recordAction('egg_pawn_'+order);
                }
                if(supportUsed)this.characterCooldownUntil=now+650;
            }
            const floor=cpu.feetY-cpu.height-12;
            const targetY=Math.max(48,Math.min(floor-76,player.y+(player.height-cpu.height)*.55-56));
            const climb=cpu.y>targetY+12;
            const descend=cpu.y<targetY-18;
            if (!climb && !descend && now>=this.characterCooldownUntil) {
                const move=distance<110?(now>=(cpu.eggReady?.protocol??0)?'protocol':'jab')
                    :distance<235?(now>=(cpu.eggReady?.rampage??0)?'rampage':'low')
                    :distance<630?'missile':null;
                if (move && cpu.startMove(move,player)) {
                    this.setMovement(cpu,false,false,false);
                    this.recordAction('egg_'+move);
                    wait(800);
                    return true;
                }
            }
            const retreat=distance<115;
            const advance=distance>220;
            const left=retreat?direction>0:advance&&direction<0;
            const right=retreat?direction<0:advance&&direction>0;
            this.setMovement(cpu,left,right,descend,climb);
            return true;
        }
        if (cpu.characterId==='sonic' && !cpu.isBusy() && now>=this.characterCooldownUntil && this.random()<.55) {
            const close=distance<145, mid=distance<325, level=Math.abs(player.y-cpu.y)<105;
            const move=cpu.isGrounded?(close?(this.random()<.36?'barrage':'jab')
                :mid?'windmill':level&&distance<630?'wave':null)
                :close?'rocket':mid&&level?'eagle':null;
            if(move && startSonicMove(cpu,move,player)) {
                this.recordAction('sonic_'+move);
                wait(680);
                return true;
            }
        }
        if (cpu.characterId === 'sonic' && !cpu.isGrounded && now>=this.characterCooldownUntil &&
            this.random()<.12 && cpu.startHoming(player)) {
            wait(850);
            return true;
        }
        if (cpu.characterId === 'metal-sonic' && now >= this.characterCooldownUntil) {
            const airborne = !cpu.isGrounded;
            let technique;
            if (airborne && distance < 115 && Math.abs(player.y - cpu.y) < 85) technique = 'air';
            else if (!airborne && distance > 275 && distance < 695 && Math.abs(player.y - cpu.y) < 75 && this.random() < .38) {
                technique = this.random() < .34 ? 'wave' : 'cannon';
            }
            if (technique && cpu.beginMetalTechnique(technique, player)) {
                this.setMovement(cpu, false, false, false);
                this.recordAction('metal_' + technique);
                wait(950);
                return true;
            }
        }
        if (['sonic', 'metal-sonic'].includes(cpu.characterId) && cpu.isGrounded && distance > 120 && distance < 270 && now >= this.characterCooldownUntil &&
            (Math.abs(cpu.vx) > .1 || cpu.isDashing || this.random() < .22) && cpu.startBrake(this.random() < .28)) {
            this.setMovement(cpu, false, false, false); this.recordAction('brake'); wait(850); return true;
        }

        if (['sonic', 'metal-sonic'].includes(cpu.characterId) && cpu.isGrounded && distance >= 190 && distance <= 420 &&
            now >= this.characterCooldownUntil && this.random() < .20) {
            this.setMovement(cpu, toward === cpu.controls.left, toward === cpu.controls.right, false, true);
            this.recordAction('approach'); wait(1650); return true;
        }

        if (['sonic', 'metal-sonic'].includes(cpu.characterId) && !cpu.isGrounded && !cpu.rocketActive && !cpu.isVulnerable &&
            distance >= 110 && distance <= 620 && now >= this.characterCooldownUntil && this.random() < .78) {
            cpu.startRocket(player.x);
            if (cpu.rocketActive) { this.recordAction('sonic_rocket'); wait(1250); return true; }
        }

        if (cpu.characterId === 'x' && distance >= 160 && distance <= 540 &&
            !player.isGuarding && cpu.startNova()) {
            this.recordAction('heavy');
            wait(1100);
            return true;
        }
        if (cpu.characterId === 'x' && distance < 140 && now >= this.characterCooldownUntil &&
            (cpu.saberDrawn ? cpu.startSaber() :
                cpu.startPhysical(cpu.isGrounded ? 'jab' : 'airPunch'))) {
            this.recordAction('heavy');
            wait(700);
            return true;
        }
        if (cpu.characterId === 'protoman' && distance < 135 && now >= this.characterCooldownUntil &&
            cpu.startRobotAction(distance < 82 ? 'punch' : 'bash')) {
            this.setMovement(cpu, false, false, false);
            this.recordAction('heavy');
            wait(680);
            return true;
        }

        if (cpu.characterId === 'zero' && cpu.isGrounded && now >= this.characterCooldownUntil) {
            const attack = !player.isGrounded && distance < 145 ? 'ELECUP'
                : player.isGuarding && player.guardType === 'high' && distance < 125 ? 'CROUCH'
                : distance >= 245 && distance <= 430 && this.random() < .35 ? 'THRUST'
                : distance >= 165 && distance <= 245 ? 'FROSTDASH'
                : distance >= 120 && distance < 165 ? 'ADVANCE' : null;
            if (attack && cpu.startSaberAttack(attack)) {
                this.setMovement(cpu, false, false, false);
                this.recordAction('heavy');
                wait(1100);
                return true;
            }
        }

        if (cpu.characterId === 'espio' && player.characterId === 'bass' && distance > 210 &&
            distance < 850 && now >= this.characterCooldownUntil) {
            cpu.isThrowingShuriken = true;
            cpu.shurikenTimer = 0;
            cpu.shurikenWindup = 5;
            this.setMovement(cpu, false, false, false);
            wait(1450); return true;
        }
        if (cpu.hasBuster && player.characterId === 'bass' && distance > 155 && distance < 950 &&
            this.chargeBusterAgainstBass(cpu, player, now)) return true;
        if (cpu.hasBuster && (!cpu.rockCopyEnabled || cpu.weaponSet === 'base') && distance > 155 && distance < 950 && now >= this.busterCooldownUntil) {
            if (!cpu.busterCharging) {
                cpu.busterCharging = true; cpu.busterChargeStart = now; cpu.busterChargeLevel = 1;
                this.currentAction = 'buster'; this.setMovement(cpu, false, false, false);
                return true;
            }
            const desired = distance > 530 ? 1550 : distance > 300 ? 760 : 350;
            if (now - cpu.busterChargeStart >= desired) {
                const level = getBusterLevel(cpu), direction = player.x > cpu.x ? 1 : -1;
                game.projectiles.push(new BusterProjectile(cpu, level, direction));
                cpu.busterCharging = false; cpu.busterChargeStart = 0; cpu.onBusterFired?.(level, direction);
                this.recordAction('buster'); this.busterCooldownUntil = now + (level >= 3 ? 2100 : 1000);
                return true;
            }
            return true;
        }
        return false;
    }

    chargeBusterAgainstBass(cpu, player, now) {
        if (now < this.busterCooldownUntil) return false;
        this.setMovement(cpu, false, false, false);
        if (!cpu.busterCharging) {
            cpu.busterCharging = true;
            cpu.busterChargeStart = now;
            return true;
        }
        const level = getBusterLevel(cpu);
        if (level < 3) return true;
        const direction = player.x > cpu.x ? 1 : -1;
        game.projectiles.push(new BusterProjectile(cpu, level, direction));
        cpu.busterCharging = false;
        cpu.busterChargeStart = 0;
        cpu.onBusterFired?.(level, direction);
        this.recordAction('buster');
        this.busterCooldownUntil = now + 3000;
        return true;
    }

    refuelEggmobile(cpu) {
        cpu.cpuRefueling=cpu.fuel<19 || (cpu.cpuRefueling && cpu.fuel<68);
        if (!cpu.cpuRefueling) return false;
        this.setMovement(cpu,false,false,!cpu.isGrounded);
        return true;
    }

    interceptEggman(player,cpu,distance,towardRight,now) {
        const lift=cpu.y+cpu.height*.54-(player.y+player.height*.56);
        if ((cpu.characterId==='eggman'?Math.abs(lift):lift)<64 && cpu.activeRush?.state!=='coil' && cpu.activeRush?.state!=='coil_start') return false;
        if (cpu.isHitstunned() || cpu.isVulnerable) return false;
        const [preferred,style]=AIR_MATCHUPS[cpu.characterId]??[200,'jump'];
        const dir=towardRight?1:-1;
        const travel=distance>preferred+55?dir:distance<preferred-80?-dir:0;
        if (style==='coil' && cpu.activeRush &&
            (cpu.activeRush.state==='coil'||cpu.activeRush.state==='coil_start')) {
            const rush=cpu.activeRush;
            const frame=rush.getPixelBodyFrame();
            const springX=frame?frame.dx+frame.dw*(frame.flipX?.75:.25):rush.x;
            const delta=springX-(cpu.x+cpu.width/2);
            if (rush.state==='coil_start' || cpu.isGrounded || cpu.vy<0 || cpu.vy<16 && Math.abs(delta)<180) {
                const steer=Math.abs(delta)>8?Math.sign(delta):0;
                this.setMovement(cpu,steer<0,steer>0,false,cpu.isGrounded && rush.state==='coil' && Math.abs(delta)<65);
                return true;
            }
        }
        if (cpu.isBusy()) return false;
        if (now<(this.eggInterceptAt??0)) return true;
        const nearLevel=Math.abs(lift)<115;
        let used=false;
        if (style==='coil' && cpu.isGrounded && lift>95 && distance<740) {
            used=cpu.startRushCoil();
            if (used) this.recordAction('rush_coil_intercept');
        } else if (style==='coil' && !cpu.isGrounded && nearLevel && distance<420) {
            cpu.selectWeaponSet('cut_concrete');
            used=cpu.startRollingCutter('upper');
        } else if (style==='bass' && distance<780) {
            used=cpu.tryShoot(lift>70?'up':'neutral','forward');
        } else if (style==='tails' && !cpu.isGrounded && lift>85) {
            this.setMovement(cpu,dir<0,dir>0,false);
            cpu.keys[cpu.controls.spinKey]=true;
            cpu.handleCommand(cpu.controls.spinKey,player);
            return true;
        } else if (style==='projectile' && !cpu.isGrounded && nearLevel && distance<540) {
            cpu.isThrowingShuriken=true;
            cpu.shurikenTimer=0;
            cpu.shurikenWindup=5;
            used=true;
        } else if (style==='knuckles' && !cpu.isGrounded && nearLevel && distance<265) {
            if (cpu.glide && distance<135) cpu.attackFromGlide();
            else if (!cpu.glide) cpu.startGlide(dir);
            used=cpu.glide;
        } else if (style==='zero' && nearLevel && distance<170) {
            used=cpu.startSaberAttack(cpu.isGrounded?'UPPER':'AIR');
        } else if (style==='mmzero' && !cpu.isGrounded && nearLevel && distance<180) {
            cpu.chooseAttack(cpu.controls.attack,player);
            used=cpu.isBusy();
        } else if (style==='emerl' && !cpu.isGrounded && nearLevel && distance<250) {
            used=cpu.startEmerlMove('rocket');
        } else if (style==='buster' && !cpu.isGrounded && nearLevel && distance<720 && cpu.canUseBuster()) {
            if (!cpu.busterCharging) {
                cpu.busterCharging=true;
                cpu.busterChargeStart=now;
                cpu.busterChargeLevel=1;
            } else if (getBusterLevel(cpu)>=2 || distance<200 || cpu.vy>3) {
                game.projectiles.push(new BusterProjectile(cpu,getBusterLevel(cpu),dir));
                cpu.busterCharging=false;
                cpu.busterChargeStart=0;
                this.eggInterceptAt=now+490;
            }
            this.setMovement(cpu,travel<0,travel>0,false);
            return true;
        } else if (style==='shadow' && !cpu.isGrounded && nearLevel && distance<420) {
            used=cpu.startRocket();
        } else if (style==='silver' && !cpu.isGrounded && nearLevel && distance<355) {
            used=cpu.startTechnique('push',player);
        } else if (style==='sonic' && !cpu.isGrounded && distance<285) {
            used=cpu.startHoming(player);
        } else if (style==='metal' && !cpu.isGrounded && distance<290) {
            used=cpu.beginMetalTechnique(distance<170?'eagle':'cannonAir',player);
        } else if (style==='chaos' && !cpu.isGrounded && distance<210) {
            used=cpu.beginMove('aim',player);
        } else if (style==='flight') {
            if (this.refuelEggmobile(cpu)) return true;
            if (nearLevel) used=cpu.startMove(distance<240?'high':'missile',player);
            this.setMovement(cpu,travel<0,travel>0,lift<-35,lift>35);
            if (used) this.eggInterceptAt=now+580;
            return true;
        }
        if (used) {
            this.eggInterceptAt=now+520;
            this.setMovement(cpu,false,false);
            return true;
        }
        if (nearLevel && !cpu.isGrounded && distance<400) {
            if (style==='coil' && cpu.weaponSet!=='base') cpu.selectWeaponSet('base');
            if (this.runCharacterPlan(player,cpu,distance,towardRight,now)) return true;
            if (distance<155) { this.act('heavy',cpu,now); return true; }
        }
        const rushBounce=style==='coil' && cpu.activeRush?.state==='coil_bounce';
        const forceApproach=lift>145 && ['jump','knuckles','zero','mmzero','emerl','sonic','metal','chaos','tails'].includes(style) && distance>105;
        const step=forceApproach||rushBounce&&distance>100?dir:travel;
        this.setMovement(cpu,step<0,step>0,false,cpu.isGrounded && distance<preferred+200);
        return true;
    }

    update(player, cpu, canFight, now = combatNow()) {
        if (!canFight || !player || !cpu || cpu.health <= 0 || player.health <= 0) {
            if (cpu) this.setMovement(cpu, false, false, false);
            return;
        }
        const dx = (player.x + player.width / 2) - (cpu.x + cpu.width / 2);
        const distance = Math.abs(dx);
        const towardRight = dx > 0;
        const plan=this.matchupPlan=matchupFor(cpu.characterId,player.characterId);

        if (!canFight || cpu.health <= 0 || player.health <= 0) return;
        player.answerPuddleAsCpu?.(cpu, () => this.random());
        const side = game.p1 === cpu ? 'p1' : game.p2 === cpu ? 'p2' : null;
        if (game.teamFighters && side && cpu.tagLockedUntil > now) {
            this.setMovement(cpu, false, false, false);
            return;
        }
        if (side && game.teamFighters?.[side]?.some((fighter, i) => i !== game.teamActiveIndex[side] && fighter.health > 0) &&
            cpu.health <= cpu.maxHealth * .58 && now >= (game.tagCooldowns[side] || 0) &&
            (cpu.health <= cpu.maxHealth * .42 || !cpu.isGrounded || cpu.isVulnerable || distance > 520)) {
            game.tagRequests[side] = true;
            this.setMovement(cpu, false, false, false);
            return;
        }
        if (side && game.teamFighters && distance>138 && distance<340 && !cpu.isBusy() &&
            now>=(this.nextTeamCall??0) && (player.isBusy()||player.isGuarding)) {
            this.nextTeamCall=now+900;
            if (requestTeamAssist(side,0)||requestTeamAssist(side,1)) this.recordAction('team_assist');
        }
        if (player.characterId==='eggman' && this.interceptEggman(player,cpu,distance,towardRight,now)) return;
        if (cpu.characterId==='megaman-zero') {
            const shield=cpu.controls.heavy;
            const wasHoldingShield=cpu.keys[shield];
            cpu.keys[shield]=false;
            if (hasIncomingProjectile(player,cpu)) this.mmzeroShieldHoldUntil=now+135;
            if (now<(this.mmzeroShieldHoldUntil??0) && !cpu.isBusy() && cpu.canAct() && cpu.shieldAvailable(now)) {
                const x=cpu.x+cpu.width/2, end=player.x+player.width/2;
                const floor=cpu.y+cpu.height;
                const surfaces=[...(game.battleStage?.platforms??[])];
                for (const block of player.concretes??[]) if(block.isPlatform()) {
                    const rect=block.platformRect;
                    surfaces.push({x:rect.x,end:rect.x+rect.w,y:rect.y});
                }
                const cover=surfaces.some(surface=>{
                    const rise=floor-surface.y;
                    const gap=towardRight?surface.x-x:x-surface.end;
                    return rise>55 && rise<200 && gap>=-15 && gap<195 &&
                        surface.x<Math.max(x,end) && surface.end>Math.min(x,end);
                });
                const jump=cover && cpu.isGrounded && now>=(this.pelletApproachAt??0);
                if (jump) {
                    this.pelletApproachAt=now+680;
                    this.recordAction('mmzero_cover_jump');
                } else if (!wasHoldingShield) this.recordAction('mmzero_shield_advance');
                cpu.keys[shield]=true;
                const advance=distance>205;
                this.setMovement(cpu,advance&&!towardRight,advance&&towardRight,false,jump);
                return;
            }
        }
        if (this.spinPlan) {
            if (cpu.isHitstunned?.() || cpu.isVulnerable || (!cpu.isSpinning && !cpu.isGrounded) ||
                now - this.spinPlan.started > 1650) {
                if (cpu.isSpinning) cpu.finishSpinDash(false);
                this.spinCooldownUntil = now + 950;
                this.spinPlan = null;
                this.setMovement(cpu, false, false, false);
                return;
            }
            this.setMovement(cpu, false, false, true);
            if (cpu.isSpinDashActive) {
                this.spinPlan = null;
                this.spinCooldownUntil = now + 4200;
                this.setMovement(cpu, false, false, false);
            } else if (cpu.isSpinning && (cpu.spinChargeLevel >= this.spinPlan.target || (distance < 125 && cpu.spinChargeLevel > 0))) {
                cpu.spinDirection = towardRight ? 1 : -1;
                cpu.releaseSpinDash();
                this.spinPlan = null;
                this.spinCooldownUntil = now + 4200;
                this.setMovement(cpu, false, false, false);
            } else if (cpu.isCrouching) {
                cpu.chargeSpinDash(cpu.x + dx, cpu.controls.spinKey);
            }
            return;
        }
        if (this.shadowMagicPlan && cpu.characterId === 'shadow') {
            if (cpu.magicCharge?.ticks >= 22) {
                cpu.releaseChaosMagic();
                this.shadowMagicPlan = false;
                this.shadowSpecialCooldownUntil = now + 1600;
            }
            return;
        }
        const snakeThreat = hasIncomingGroundThreat(player, cpu);
        const projectileThreat = hasIncomingProjectile(player, cpu);
        const closeThreat = hasNearIncomingAttack(player, cpu, distance);
        const threatened = closeThreat || projectileThreat || snakeThreat;
        const silverReserve = side && game.teamFighters?.[side]?.some(member=>member!==cpu&&member.characterId==='silver'&&member.health>0);
        if ((cpu.characterId==='silver' || silverReserve) && now >= (this.silverReadAt??0)) {
            const x=cpu.x+cpu.width/2;
            const y=cpu.y+cpu.height*.52;
            const shot=[...game.projectiles,...game.bassBullets].find(p=>{
                const kind=silverShotKind(p), gap=x-p.x-p.width/2;
                const speed=p.vx ?? ((p.x-(p.prevX??p.x))*1.15);
                if (!p.active || p.owner!==player || !kind || gap*speed<=0 || Math.abs(p.y+p.height/2-y)>95) return false;
                return Math.abs(gap/speed) >= 8 && Math.abs(gap/speed) < 27;
            });
            if (shot) {
                this.silverReadAt=now+75;
                if (cpu.characterId==='silver' && !cpu.isBusy() && this.random()<.78 && cpu.startTechnique('field',player)) {
                    this.setMovement(cpu,false,false);
                    this.recordAction(silverShotKind(shot)==='energy'?'silver_absorb':'silver_reflect');
                    return;
                }
                if (silverReserve && silverShotKind(shot)==='energy') {
                    const slot=teamAssistSlots(side).findIndex(f=>f.characterId==='silver'&&f.health>0);
                    if (slot>=0 && requestTeamAssist(side,slot,{defensive:true})) this.recordAction('silver_assist');
                }
            }
        }
        if (cpu.isSpinDashActive) {
            if (cpu.characterId==='sonic' && cpu.startHoming(player)) {
                this.setMovement(cpu,false,false,false);
                this.recordAction('sonic_homing');
                return;
            }
            this.setMovement(cpu, false, false, false);
            if (distance > 370 && cpu.spinDirection !== (towardRight ? 1 : -1) && cpu.spinChargeLevel < 3) cpu.finishSpinDash(true);
            return;
        }
        const neutralGuardRange = distance <= 300 && cpu.isGrounded && !cpu.isBusy?.();
        if (!threatened && !neutralGuardRange) this.guardHoldUntil = 0;
        if (threatened && !this.guardReactionAt) this.guardReactionAt = now + 40 + this.random() * 35;
        if (!threatened) this.guardReactionAt = 0;
        const canGuard = cpu.isGrounded && !cpu.isBusy?.() && !cpu.isVulnerable && !cpu.isIntroActive;
        if (cpu.rockCopyEnabled && !cpu.busterCharging && !threatened && !cpu.isBusy() &&
            now >= (this.emerlMeleeAt ?? 0)) {
            const cycle = ['punch', 'roundhouse', 'upper'];
            const index = this.emerlMeleeCount ?? 0;
            if (cpu.isGrounded && distance >= 110 && distance < 178 && index % 4 === 3 &&
                now >= (this.emerlHopUntil ?? 0)) {
                this.emerlHopUntil = now + 1250;
                this.setMovement(cpu, !towardRight, towardRight, false, true);
                return;
            }
            const move = !cpu.isGrounded && distance < 175 ? 'rocket'
                : !player.isGrounded && distance < 145 ? 'upper'
                : distance < 160 ? cycle[index % cycle.length]
                : distance < 365 && cpu.isGrounded ? 'waveKick' : null;
            if (move && cpu.startEmerlMove(move)) {
                this.emerlMeleeCount = index + 1;
                this.emerlMeleeAt = now + 720;
                this.characterCooldownUntil = Math.max(this.characterCooldownUntil, now + 420);
                this.setMovement(cpu, false, false, false);
                this.recordAction('emerl_' + move);
                return;
            }
        }
        if (cpu.rockCopyEnabled && !cpu.busterCharging && cpu.isGrounded && player.isGrounded &&
            !cpu.isBusy() && !threatened && distance >= 130 && distance <= 290 && now >= this.spinCooldownUntil) {
            this.act('spin', cpu, now);
            return;
        }
        if (cpu.characterId === 'protoman') {
            const guard = !cpu.shieldThrow && now >= (cpu.guardBrokenUntil || 0) &&
                canGuard && projectileThreat && now >= this.guardReactionAt;
            cpu.keys[cpu.controls.heavy] = guard;
            if (guard) {
                this.setMovement(cpu,false,false,false);
                return;
            }
            if (cpu.lastProjectileBlockAt > (this.lastProtoCounterAt ?? -Infinity) &&
                now-cpu.lastProjectileBlockAt < 850 && cpu.canUseBuster() && distance < 950) {
                this.lastProtoCounterAt = cpu.lastProjectileBlockAt;
                if (distance < 120 && cpu.startRobotAction('bash')) {
                    this.recordAction('heavy');
                } else {
                    const direction = towardRight ? 1 : -1;
                    const level = cpu.busterCharging ? getBusterLevel(cpu) : 1;
                    cpu.busterCharging = false;
                    cpu.busterChargeStart = 0;
                    game.projectiles.push(new BusterProjectile(cpu,level,direction));
                    cpu.onBusterFired(level,direction);
                    this.recordAction('buster');
                    this.busterCooldownUntil = now+750;
                }
                return;
            }
        }
        if ((cpu.characterId === 'protoman' || cpu.rockCopyEnabled) && cpu.canUseBuster() &&
            now >= this.busterCooldownUntil &&
            (cpu.busterCharging || distance >= (cpu.rockCopyEnabled ? (cpu.weaponSet !== 'base' ? 560 : 425) : 145) && distance < 1000)) {
            this.setMovement(cpu, false, false, false);
            if (!cpu.busterCharging) {
                cpu.busterCharging = true;
                cpu.busterChargeStart = now;
                this.currentAction = 'buster';
            } else if (getBusterLevel(cpu) >= (distance < 290 ? 2 : 3)) {
                const level = getBusterLevel(cpu);
                game.projectiles.push(new BusterProjectile(cpu, level, towardRight ? 1 : -1));
                cpu.busterCharging = false;
                cpu.busterChargeStart = 0;
                cpu.onBusterFired?.(level, towardRight ? 1 : -1);
                this.recordAction('buster');
                this.busterCooldownUntil = now + (cpu.rockCopyEnabled && cpu.weaponSet !== 'base' ? 4800 : 2100);
            }
            return;
        }
        const bassFiring = player.characterId === 'bass' && player.state === 'shoot';
        if (now >= this.nextDecisionAt && !cpu.isBusy?.() && !cpu.isVulnerable &&
            (!projectileThreat || now >= this.guardReactionAt)) {
            if (cpu.characterId === 'bass' && canGuard &&
                (player.shadowTeleportPhase === 'out' || (player.busterCharging && distance < 620))) {
                const direction = towardRight ? 'left' : 'right';
                cpu.tryDash(direction);
                cpu.tryDash(direction);
                this.nextDecisionAt = now + 520;
                return;
            }
            if (bassFiring && cpu.characterId === 'shadow' && distance < 650 &&
                now >= this.shadowSpecialCooldownUntil && cpu.startShadowTeleport(player)) {
                this.recordAction('teleport');
                this.shadowSpecialCooldownUntil = now + 1750;
                return;
            }
            if (cpu.characterId === 'metal-sonic' && canGuard && projectileThreat &&
                distance > 280 && now >= this.characterCooldownUntil &&
                (player.characterId === 'bass' ? this.random() < .78 : this.random() < .38) &&
                cpu.beginMetalTechnique('diamond', player)) {
                this.setMovement(cpu, false, false, false);
                this.recordAction('metal_diamond');
                this.characterCooldownUntil = now + 850;
                this.nextDecisionAt = now + 415;
                return;
            }
            if (player.characterId === 'bass' && ['sonic', 'metal-sonic'].includes(cpu.characterId) && distance > 95 && distance < 780) {
                if (canGuard && !bassFiring && !projectileThreat && distance > 320 && now >= this.spinCooldownUntil) {
                    this.act('spin', cpu, now);
                    return;
                }
                if (canGuard || !cpu.isGrounded) {
                    this.setMovement(cpu, !towardRight, towardRight, false, canGuard);
                    if (!cpu.isGrounded && distance > 110 && now >= this.characterCooldownUntil) {
                        cpu.startRocket(player.x);
                        if (cpu.rocketActive) { this.recordAction('sonic_rocket'); this.characterCooldownUntil = now + 1250; }
                    }
                    this.nextDecisionAt = now + 260;
                    return;
                }
            }
        }
        if (cpu.characterId === 'bass' && !projectileThreat && !snakeThreat && !cpu.isBusy() && !cpu.isVulnerable &&
            !cpu.isHitstunned()) {
            const aim = towardRight ? 1 : -1;
            const runway = towardRight ? HIGHWAY_WALLS[1].x - player.x - player.width : player.x - HIGHWAY_WALLS[0].x;
            if (now < (this.bassJetFollowUntil ?? 0) && aim !== this.bassJetDirection && distance < 175 &&
                cpu.startRobotAction(cpu.isGrounded ? 'kick' : 'punch')) {
                this.bassJetFollowUntil = 0;
                this.bassKickNext = now + 2400;
                this.characterCooldownUntil = now + 620;
                this.recordAction(cpu.isGrounded ? 'bass_kick' : 'bass_air_punch');
                return;
            }
            if (cpu.isGrounded && distance <= 202 && now >= (this.bassKickNext ?? 0) && Math.abs(player.y - cpu.y) < 115 && cpu.startRobotAction('kick')) {
                this.bassKickNext = now + 3150;
                this.characterCooldownUntil = now + 780;
                this.guardHoldUntil = 0;
                this.recordAction('bass_kick');
                return;
            }
            if (distance > 202 && distance < 275 && cpu.isGrounded && Math.abs(player.y - cpu.y) < 115 &&
                now >= (this.bassKickNext ?? 0)) {
                this.setMovement(cpu, !towardRight, towardRight, false);
                this.nextDecisionAt = now + 115;
                return;
            }
            if (distance > 178 && distance <= 390 && runway > 90 &&
                now >= (this.bassJetNext ?? 0) &&
                cpu.startJet(aim, true)) {
                this.bassJetDirection = aim;
                this.bassJetFollowUntil = now + 1120;
                this.setMovement(cpu, false, false, false);
                this.bassJetNext = now + 3100;
                this.characterCooldownUntil = now + 690;
                this.guardHoldUntil = 0;
                this.recordAction('bass_jet');
                return;
            }
            if (distance < 130 && cpu.startRobotAction('punch')) {
                this.characterCooldownUntil = now + 640;
                this.recordAction('kick');
                return;
            }
        }
        if (neutralGuardRange && now >= this.guardNextAt && !this.guardHoldUntil && !snakeThreat && !player.isAttacking?.() && !projectileThreat) {
            this.guardHoldUntil = now + 350 + this.random() * 300;
            this.guardNextAt = now + 600 + this.random() * 650;
        }
        if (threatened && now >= this.guardReactionAt && canGuard) {
            this.guardHoldUntil = Math.max(this.guardHoldUntil, now + 180 + this.random() * 180);
        }
        if (this.guardHoldUntil > now && canGuard && !snakeThreat) {
            const back = towardRight ? cpu.controls.left : cpu.controls.right;
            const low = Boolean(player.isCrouching);
            this.setMovement(cpu, back === cpu.controls.left, back === cpu.controls.right, low);
            if (this.currentAction !== 'guard') {
                this.currentAction = 'guard';
                this.actionCounts.guard = (this.actionCounts.guard || 0) + 1;
                this.guardCounter++;
                if (this.lastAction === 'guard') this.actionStreak++;
                else { this.lastAction = 'guard'; this.actionStreak = 1; }
            }
            return;
        }
        if (snakeThreat && canGuard) {
            const back = towardRight ? cpu.controls.left : cpu.controls.right;
            this.setMovement(cpu, back === cpu.controls.left, back === cpu.controls.right, false, true);
            this.guardHoldUntil = 0;
            this.currentAction = 'evade';
            return;
        }
        if (this.currentAction === 'guard') {
            this.setMovement(cpu, false, false, false);
            this.currentAction = 'approach';
        }
        if (cpu.characterId === 'knuckles' && cpu.minerPhase === 'under' && now >= this.characterCooldownUntil) {
            const leave = Math.abs(dx) < Math.max(90, cpu.width * .62) || now - cpu.undergroundStart > 2900;
            this.setMovement(cpu, dx < 0 && !leave, dx > 0 && !leave, false);
            if (leave) { cpu.beginMinerExit(); this.recordAction('knuckles_miner'); this.characterCooldownUntil = now + 2100; }
            return;
        }
        if (now < this.nextDecisionAt) return;
        this.nextDecisionAt = now + 240 + this.random() * 150;

        if (cpu.isBusy?.() || cpu.isVulnerable || cpu.isIntroActive || cpu.state === 'intro') {
            this.setMovement(cpu, false, false, false);
            return;
        }

        if (cpu.characterId==='megaman-zero' && now>=this.characterCooldownUntil) {
            if (cpu.busterCharging && (distance<145 || now-cpu.busterChargeStart>=720)) {
                cpu.releaseWeapon(cpu.controls.kickLight,player);
                this.recordAction('mmzero_buster');
                this.characterCooldownUntil=now+620;
                return;
            }
            if (distance>=290 && distance<=850) {
                if (!cpu.busterCharging) cpu.chooseAttack(cpu.controls.kickLight,player);
                this.setMovement(cpu,!towardRight,towardRight,false);
                return;
            }
            const key=!cpu.isGrounded?'saberAir':distance<109?'saberA':distance<186?'recoil':'chain';
            if (cpu.beginWeapon(key, player)) {
                if (key==='saberA') cpu.robotMove.chain=true;
                this.recordAction('mmzero_'+key);
                this.characterCooldownUntil=now+440;
                return;
            }
        }
        if (cpu.characterId==='silver' && now>=this.characterCooldownUntil) {
            const air=!cpu.isGrounded, roll=this.random();
            if (!air && !threatened && cpu.power>=300 && cpu.health<105 &&
                distance>380 && roll<.42 && cpu.startSuperChange()) {
                this.setMovement(cpu,false,false);
                this.recordAction('silver_transform');
                this.characterCooldownUntil=now+1400;
                return;
            }
            if (!air && distance>320 && distance<630 && roll<.19 && cpu.hover()) {
                this.setMovement(cpu,!towardRight,towardRight);
                this.characterCooldownUntil=now+390;
                this.recordAction('silver_hover');
                return;
            }
            const specialReady=now>=(cpu.psychicSpecialReadyAt??0);
            const key=!air && specialReady && distance>105 && distance<278 && !player.isGuarding && roll<.35
                ? (cpu.superSilver?'storm':'catastrophe')
                : !air && specialReady && distance>370 && distance<610 && roll<.28 ? 'barrage'
                : air ? distance<130?'air':distance<320&&!cpu.airDashUsed?'airDash':null
                : distance<100 ? (roll<.24?'grab':roll<.47?'shock':roll<.65?'upper':'jab')
                : distance<300 ? (cpu.rocks.length?'cast':roll<.22?'orbit':roll<.72?'push':'strongPush')
                : distance<550 && roll<.61 ? (cpu.rocks.length?'cast':roll<.4?'orbit':'cast') : null;
            if (key && cpu.startTechnique(key,player)) {
                if (key==='jab') cpu.robotMove.next={key:'medium'};
                this.setMovement(cpu,false,false);
                this.characterCooldownUntil=now+680;
                this.recordAction('silver_'+key);
                return;
            }
        }
        if (cpu.characterId === 'chaos' && now >= this.characterCooldownUntil) {
            const airborne = !cpu.isGrounded;
            const special = airborne ? null : cpu.power >= 100 && distance < 540
                ? (this.random() < .55 ? 'ultimate_chaos4_flood' : 'ultimate_perfect_chaos')
                : distance > 420 && this.random() < .38 ? 'special_arm_wrap'
                : distance < 320 && this.random() < .24 ? 'special_three_puddles' : null;
            if (special && cpu.startSpecial(special,player)) {
                this.recordAction(special);
                this.characterCooldownUntil = now + 1900;
                return;
            }
            const move = airborne ? (distance < 160 ? 'airCrush' : 'aim')
                : distance < 120 ? (!player.isGrounded ? 'upper' : this.random()<.42 ? 'doubleStab' : 'stretch')
                : distance < 245 ? 'dolphin' : distance < 540 && this.random()<.45 ? 'shot' : null;
            if (move && cpu.beginMove(move,player)) {
                if (move==='stretch') cpu.robotMove.chain = true;
                this.recordAction('chaos_' + move);
                this.characterCooldownUntil = now + 820;
                return;
            }
        }
        if (cpu.characterId === 'tails') {
            const ahead = towardRight ? 1 : -1;
            const approach = (jump = false) => this.setMovement(cpu, ahead < 0, ahead > 0, false, jump);
            if (now < this.characterCooldownUntil || distance > 575) {
                approach(cpu.isGrounded && distance > 340 && this.random() < .17);
                return;
            }
            if (cpu.isGrounded && distance > 115 && distance < 430 &&
                (player.isGuarding || this.random() < .28)) {
                approach(this.random() < .48);
                return;
            }
            const toolRoll = this.random();
            const technique = !cpu.isGrounded ? (player.isGrounded ? 'dunk' : 'typhoon')
                : distance > 245 ? 'cannon'
                : !player.isGrounded ? 'upper'
                : distance > 118 ? (toolRoll < .3 ? 'flick' : 'cyclone')
                : toolRoll < .35 ? 'hook' : 'iq200';
            const bomb = technique === 'flick' && player.vx * ahead < 0 &&
                !game.projectiles.some(p => p.owner === cpu && p.type === 'Chu² Bomb' && p.active);
            if (cpu.beginTechnique(technique, player, { bomb, aim: technique === 'cannon' && !player.isGrounded ? -1 : 0 })) {
                if (technique === 'iq200') cpu.robotMove.chain = true;
                const { spec } = cpu.robotMove;
                this.characterCooldownUntil = now + spec.frames * spec.ms + 320;
                this.recordAction('tails_' + (bomb ? 'bomb' : technique));
                return;
            }
        }
        if (this.runCharacterPlan(player, cpu, distance, towardRight, now)) return;

        if (cpu.supportsSpin && now >= this.spinCooldownUntil && distance >= 135 && distance <= 300 && this.random() < (['sonic', 'metal-sonic'].includes(cpu.characterId) ? .62 : cpu.characterId === 'knuckles' ? .34 : .48)) {
            this.act('spin', cpu, now);
            return;
        }

        if (cpu.characterId === 'shadow') {
            const blocked = player.isGuarding && player.isGrounded;
            if (distance <= 800 && !blocked && this.random()<.24 && cpu.startChaosNightmare()) {
                this.currentAction = 'chaos'; this.actionCounts.chaos = (this.actionCounts.chaos || 0) + 1;
                return;
            }
            if (now >= this.shadowSpecialCooldownUntil && distance > 560 && this.random() < .35 && cpu.startRoaming()) {
                this.currentAction = 'roam'; this.actionCounts.roam = (this.actionCounts.roam || 0) + 1;
                this.shadowSpecialCooldownUntil = now + 3800;
                this.setMovement(cpu, false, false, false);
                return;
            }
            if (now >= this.shadowSpecialCooldownUntil && distance >= 150 && distance <= 620 &&
                player.characterId !== 'bass' && !blocked && this.random() < .92 && cpu.startShadowTeleport(player)) {
                this.currentAction = 'teleport'; this.actionCounts.teleport = (this.actionCounts.teleport || 0) + 1;
                this.shadowSpecialChoice++;
                this.shadowSpecialCooldownUntil = now + 1750;
                return;
            }
            if (now >= this.shadowSpecialCooldownUntil && distance >= 190 && distance <= 560 &&
                !blocked && (player.characterId === 'bass' ? !cpu.isGrounded : this.random() < .25) && cpu.startChaosMagic()) {
                this.currentAction = 'magic'; this.actionCounts.magic = (this.actionCounts.magic || 0) + 1;
                this.shadowMagicPlan = true;
                this.shadowSpecialChoice++;
                return;
            }
            if (!cpu.isGrounded && distance >= 140 && cpu.startRocket()) {
                this.currentAction = 'heavy'; this.actionCounts.heavy = (this.actionCounts.heavy || 0) + 1;
                return;
            }
            if (player.characterId === 'bass' && cpu.isGrounded && distance > 180 && distance < 560 &&
                now >= this.shadowSpecialCooldownUntil && !blocked) {
                this.setMovement(cpu, !towardRight, towardRight, false, true);
                return;
            }
        }

        if (distance > 155 && distance <= 430 && ['sonic', 'metal-sonic'].includes(cpu.characterId) && this.random() < .28 && cpu.isGrounded) {
            this.setMovement(cpu, !towardRight, towardRight, false, true);
            this.act('approach', cpu, now);
            return;
        }
        const meleeRange=155;
        if (distance>meleeRange) {
            const runningIn=distance>plan.distance || !cpu.hasBuster;
            const jump=runningIn && cpu.isGrounded && distance<plan.distance+235 && this.random()<plan.air;
            this.setMovement(cpu,runningIn&&!towardRight,runningIn&&towardRight,false,jump);
            if (!runningIn && cpu.hasBuster && this.random()<.28) this.act('jab',cpu,now);
            else this.act('approach',cpu,now);
            return;
        }
        if (plan.retreat && distance<105 && this.random()<.32) {
            this.setMovement(cpu,towardRight,!towardRight);
            return;
        }
        this.setMovement(cpu, false, false, false);
        this.act(this.chooseMove(distance), cpu, now);
    }

    onHit(damage) {
        this.hitsThisMatch++;
        this.profile.hits++;
        this.lastHitAt = combatNow();
        this.reward(this.currentAction, .42 + Math.min(.8, damage / 36), 'Recibió recompensa por acertar');
    }

    onBlocked() {
        this.reward(this.currentAction, -.18, 'El rival protegió: ajustar la elección de ataque');
    }

    onGuard() {
        this.blocksThisMatch++;
        this.profile.blocks++;
        this.reward('guard', .22, 'Recibió recompensa por cubrirse');
    }

    onHitTaken(damage) {
        const exposedAction = this.currentAction === 'guard' ? this.lastAction : this.currentAction;
        this.reward(exposedAction, -Math.min(.55, damage / 32), 'Ajuste por recibir daño');
    }

    finish(won) {
        this.profile.matches++;
        if (won === null) this.profile.draws++;
        else this.profile[won ? 'wins' : 'losses']++;
        const countList = Object.entries(this.actionCounts).filter(([name]) => name !== 'approach');
        const total = countList.reduce((sum, [, count]) => sum + count, 0);
        const mostUsed = countList.reduce((best, row) => Math.max(best, row[1]), 0);
        const repetitionRatio = total ? mostUsed / total : 0;
        let terminalReward = won === null ? 0 : won ? 3 : -2.4;
        if (won && repetitionRatio > .62) {
            terminalReward -= 1.8;
            this.repeatPenalties++;
            this.profile.penalties++;
            this.lastRewardText = 'Ganó, pero con penalización por repetir el mismo ataque';
        } else if (won && countList.length >= 3) {
            terminalReward += .5;
            this.lastRewardText = 'Ganó usando una estrategia variada';
        } else {
            this.lastRewardText = won === null ? 'El combate terminó en empate' : won ? 'La CPU ganó el combate' : 'La CPU perdió y ajustará su estrategia';
        }
        this.reward(this.lastAction, terminalReward, this.lastRewardText);
        this.save();
    }

    resetMatch() {
        this.lastProtoCounterAt = -Infinity;
        this.nextDecisionAt = 0;
        this.currentAction = 'approach';
        this.lastAction = null;
        this.actionStreak = 0;
        this.actionCounts = {};
        this.hitsThisMatch = 0;
        this.blocksThisMatch = 0;
        this.repeatPenalties = 0;
        this.spinPlan = null;
        this.spinCooldownUntil = 0;
        this.shadowMagicPlan = false;
        this.shadowSpecialCooldownUntil = 0;
        this.shadowSpecialChoice = 0;
        this.guardReactionAt = 0;
        this.guardHoldUntil = 0;
        this.guardNextAt = 0;
        this.guardCounter = 0;
    }
}
