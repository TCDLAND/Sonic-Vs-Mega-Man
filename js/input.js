// ========================================
// EVENTOS DE TECLADO
// ========================================

import { game } from './state.js';
import { GAME_STATE } from './config.js';
import { Espio } from './espio.js';
import { Sonic } from './sonic.js';
import { Shadow } from './shadow.js';
import { Zero } from './zero.js';
import { Rock } from './rock.js';
import { Knuckles } from './knuckles.js';
import { Bass, Treble } from './bass.js';
import { startBattle } from './battle.js';
import { BusterProjectile, getBusterLevel } from './buster-system.js';
import { getTouchedWall } from './wall-system.js';

export function setupInput() {
    window.addEventListener('keydown', (e) => {
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') return;
        if (e.code === 'Space' || e.code === 'Enter') e.preventDefault();

        // ============================
        // SELECCIÓN
        // ============================
        if (game.gameState === GAME_STATE.SELECT) {
            const chars = game.characterSelection.chars;

            if (!game.characterSelection.p1Confirmed) {
                if (e.code === 'KeyA' && !e.repeat) {
                    game.characterSelection.p1Index = (game.characterSelection.p1Index - 1 + chars.length) % chars.length;
                }
                if (e.code === 'KeyD' && !e.repeat) {
                    game.characterSelection.p1Index = (game.characterSelection.p1Index + 1) % chars.length;
                }
                if (e.code === 'KeyJ' && !e.repeat) {
                    game.characterSelection.p1Confirmed = true;
                }
            }

            if (!game.characterSelection.p2Confirmed) {
                if (e.code === 'ArrowLeft' && !e.repeat) {
                    game.characterSelection.p2Index = (game.characterSelection.p2Index - 1 + chars.length) % chars.length;
                }
                if (e.code === 'ArrowRight' && !e.repeat) {
                    game.characterSelection.p2Index = (game.characterSelection.p2Index + 1) % chars.length;
                }
                if (e.code === 'Comma' && !e.repeat) {
                    game.characterSelection.p2Confirmed = true;
                }
            }

            if (game.characterSelection.p1Confirmed && game.characterSelection.p2Confirmed) {
                startBattle();
            }

            return;
        }

        // ============================
        // BATALLA
        // ============================
        if (game.gameState !== GAME_STATE.BATTLE) return;
        if (!game.p1 || !game.p2) return;

        const p1 = game.p1;
        const p2 = game.p2;

        // ROCK — doble abajo abre el mini selector; el tercer input selecciona.
        // abajo+abajo+arriba = CUT/CONCRETE; abajo+abajo+abajo = BASE.
        for (const r of [p1,p2]) {
            if (r instanceof Rock && !e.repeat && r.handleWeaponSelectorInput(e.code)) return;
        }

        // Wall Jump exclusivo de X y Zero: mismo boton de salto.
        for (const [fighter, opponent] of [[p1,p2],[p2,p1]]) {
            if (e.code === fighter.controls.jump && !e.repeat && !fighter.isGrounded) {
                const wall = getTouchedWall(fighter);
                if (wall && !fighter.airMobilityLocked) {
                    fighter.vy = fighter.jumpForce;
                    // Zigzag de pared: se despega visual/físicamente un poco hacia el lado
                    // contrario y la gravedad/movimiento lo deja volver a tocar el pilar.
                    fighter.vx = wall.side === 'left' ? 7 : -7;
                    fighter.wallSliding = false;
                    if (fighter instanceof Zero && typeof fighter.startWallHop === 'function') {
                        fighter.startWallHop(wall.side);
                    }
                }
            }
        }

        // Buster universal de robots: mantener ataque para cargar, soltar para disparar.
        for (const fighter of [p1,p2]) {
            if (fighter.hasBuster && !(fighter instanceof Rock && (fighter.weaponSet === 'cut_concrete'||fighter.weaponSet === 'fire'||fighter.weaponSet === 'leaf_snake')) && e.code === fighter.controls.attack && !e.repeat && !fighter.busterCharging) {
                fighter.busterCharging = true;
                fighter.busterChargeStart = performance.now();
                fighter.busterChargeLevel = 1;
            }
        }

        p1.keys[e.code] = true;
        p2.keys[e.code] = true;

        // ROCK POWER 1 se procesa abajo junto con Rush/Beat.

        for (const f of [p1,p2]) {
            if (f instanceof Knuckles && e.code === f.controls.jump && !e.repeat && f.wallClingK) f.wallJumpPress();
        }

        // ================================================================
        // TEST TEMPORAL Treble: teclas 1-6 (P1)
        // ================================================================
        if (p1 instanceof Bass && p1.activeTreble && p1.activeTreble.isActive && !e.repeat) {
            const t = p1.activeTreble;
            if (e.code === 'Digit1') { t.startRush(); }
            if (e.code === 'Digit3') { t.startBison(); }
            if (e.code === 'Digit4') { t.startShot(false); }
            if (e.code === 'Digit5') { t.startShot(true); }
            if (e.code === 'Digit6') { t.startOutro(); }
        }

        // ================================================================
        // BASS - Disparos y Dash
        // ================================================================
        if (p1 instanceof Bass && p1.state !== "intro") {
            const dir = p1.x > p2.x ? -1 : 1;
            const forwardKey = dir === 1 ? 'KeyD' : 'KeyA';
            const backwardKey = dir === 1 ? 'KeyA' : 'KeyD';

            if (!e.repeat) {
                // J: disparo (según input de dirección)
                if (e.code === 'KeyJ') {
                    if (p1.keys['KeyW'] && p1.keys[forwardKey]) {
                        p1.tryShoot('up', 'forward');
                    } else if (p1.keys['KeyW'] && p1.keys[backwardKey]) {
                        p1.tryShoot('up', 'forward');
                    } else if (p1.keys['KeyW']) {
                        p1.tryShoot('up', 'neutral');
                    } else {
                        p1.tryShoot('neutral', 'forward');
                    }
                }

                // E: diagonal arriba (derecha)
                if (e.code === 'KeyE' && dir === 1) {
                    p1.tryShoot('up', 'forward');
                }

                // Q: diagonal arriba (izquierda)
                if (e.code === 'KeyQ' && dir === -1) {
                    p1.tryShoot('up', 'forward');
                }

                // Doble tap para dash
                if (e.code === p1.controls.left) {
                    p1.tryDash('left');
                }
                if (e.code === p1.controls.right) {
                    p1.tryDash('right');
                }

                // Invocar Treble (I)
                if (e.code === 'KeyI') {
                    if (!p1.activeTreble || !p1.activeTreble.isActive) {
                        p1.summonTreble(p2.x);
                    }
                }
            }
        }

        // ================================================================
        // ESPIO
        // ================================================================
        if (p1 instanceof Espio && !e.repeat) {
            if (e.code === 'KeyJ') {
                const p1Toward = (p2.x > p1.x) ? 'KeyD' : 'KeyA';
                if (p1.keys[p1Toward]) {
                    p1.startTongueAttack("forward", p2.x);
                } else if (p1.keys['KeyQ'] || p1.keys['KeyE']) {
                    p1.startTongueAttack("up", p2.x);
                } else {
                    p1.startJab();
                }
            }

            if ((e.code === 'KeyQ' || e.code === 'KeyE') && p1.keys['KeyJ']) {
                p1.startTongueAttack("up", p2.x);
            }

            if (e.code === 'KeyI') {
                p1.startHeavy();
            }

            if (e.code === 'KeyM') {
                const p1Backward = (p2.x > p1.x) ? 'KeyA' : 'KeyD';
                if (p1.keys['KeyW'] && p1.keys[p1Backward]) {
                    if (!p1.isThrowingShuriken) {
                        p1.isThrowingShuriken = true;
                        p1.shurikenTimer = 0;
                        p1.shurikenWindup = 5;
                    }
                } else {
                    p1.startKickLight();
                }
            }

            if (e.code === 'KeyK') {
                const now = performance.now();
                const p1Toward = (p2.x > p1.x) ? 'KeyD' : 'KeyA';
                const recentBackRelease = p1.lastBackReleaseTime && (now - p1.lastBackReleaseTime < 300);

                if (p1.isGrounded && !p1.isBusy() && recentBackRelease && p1.keys[p1Toward]) {
                    p1.lastBackReleaseTime = 0;
                    if (!p1.isThrowingKunai) {
                        p1.isThrowingKunai = true;
                        p1.kunaiTimer = 0;
                    }
                } else {
                    p1.startKickHeavy();
                }
            }
        }

        // ================================================================
        // SONIC - kit beta con sprites propios
        // J = Punch | I = Top Kick | M = Side Kick | K en aire = Sonic Rocket
        // ================================================================
        if (!e.repeat && p1 instanceof Sonic) {
            if (e.code === p1.controls.attack) p1.startPunch();
            if (e.code === p1.controls.heavy) p1.startTopKick();
            if (e.code === p1.controls.kickLight) p1.startSideKick();
            if (e.code === p1.controls.kickHeavy) {
                if (!p1.isGrounded) p1.startRocket(p2.x);
                else if (Math.abs(p1.vx) > 0.5) {
                    const oppositeHeld = (p1.vx > 0 && p1.keys[p1.controls.left]) || (p1.vx < 0 && p1.keys[p1.controls.right]);
                    p1.startBrake(oppositeHeld);
                }
            }
        }
        if (!e.repeat && p2 instanceof Sonic) {
            if (e.code === p2.controls.attack) p2.startPunch();
            if (e.code === p2.controls.heavy) p2.startTopKick();
            if (e.code === p2.controls.kickLight) p2.startSideKick();
            if (e.code === p2.controls.kickHeavy) {
                if (!p2.isGrounded) p2.startRocket(p1.x);
                else if (Math.abs(p2.vx) > 0.5) {
                    const oppositeHeld = (p2.vx > 0 && p2.keys[p2.controls.left]) || (p2.vx < 0 && p2.keys[p2.controls.right]);
                    p2.startBrake(oppositeHeld);
                }
            }
        }

        // SHADOW: J combo; I Chaos Control; M upper; K brake/slider; abajo+K TP.
        if(!e.repeat) for(const [f,opp] of [[p1,p2],[p2,p1]]){
            if(!(f instanceof Shadow))continue;
            if(e.code===f.controls.crouch)f.toggleSuperTap();
            if(e.code===f.controls.attack){
                f.startShadowChop();
            }
            if(e.code===f.controls.heavy){if(f.keys[f.controls.crouch])f.startChaosMagic();else f.startChaosNightmare();}
            if(e.code===f.controls.kickLight)f.startChaosUpper();
            if(e.code===f.controls.kickHeavy){
                if(f.keys[f.controls.crouch]&&f.isGrounded)f.startShadowTeleport(opp);
                else if(f.isGrounded&&Math.abs(f.vx)>.5){
                    const opposite=(f.vx>0&&f.keys[f.controls.left])||(f.vx<0&&f.keys[f.controls.right]);
                    f.startBrake(opposite);
                }else if(!f.isGrounded)f.startRocket();
                else f.startShadowSlider();
            }
        }

        // ================================================================
        // KNUCKLES - controles beta de prueba
        // J Punch | S+J Floor Punch | I Punch2 | hacia rival+I Agarre
        // M Upper | K en aire Glide/Glide Punch | S+K Spin Minero
        // K bajo tierra = salir donde está | doble W en pared = soltarse
        // ================================================================
        for (const [k,opp] of [[p1,p2],[p2,p1]]) {
            if (!(k instanceof Knuckles) || e.repeat) continue;
            const toward = opp.x > k.x ? k.controls.right : k.controls.left;
            if (e.code === k.controls.attack) {
                if (k.keys[k.controls.crouch]) k.startFloorPunch(); else k.startPunch();
            }
            if (e.code === k.controls.heavy) {
                if (k.keys[toward]) k.startGrab(); else k.startPunch2();
            }
            if (e.code === k.controls.kickLight) k.startUpper();
            if (e.code === k.controls.kickHeavy) {
                if (k.minerPhase === 'under') k.beginMinerExit();
                else if (k.keys[k.controls.crouch] && k.isGrounded) { k.startMiner(); }
                else if (!k.isGrounded) { if (k.glide) k.attackFromGlide(); else k.startGlide(k.facingDirection); }
            }
        }

        // ================================================================
        // ROCK + RUSH + BEAT
        // I/Y = Beat Crescent
        // izquierda+derecha+I/Y = Beat Patrol horizontal
        // Durante Patrol, I/Y solicita el drop; sale al llegar al frame 15.
        // BASE: M/A = Slash Claw. CUT/CONCRETE: D+J móvil, S+J construcción cerca, E+J construcción lejos; M Cutter, E+M Cutter alto.
        // K/B = Rush Jet | abajo+K/B = Rush Coil
        // ================================================================
        for (const r of [p1,p2]) {
            if (!(r instanceof Rock) || e.repeat) continue;
            if (e.code === r.controls.heavy && r.keys['KeyE']) { r.requestEddie(); continue; }
            if (e.code === r.controls.heavy) {
                if (r.releaseEddie()) continue;
                if (r.activeBeat?.state === 'patrol') r.requestBeatDrop();
                else if (r.keys[r.controls.left] && r.keys[r.controls.right]) r.startBeatPatrol();
                else r.startBeatCrescent();
            }
            if (r.weaponSet === 'fire' && e.code === r.controls.attack) {if(r.keys['KeyE']||r.keys['KeyQ'])r.startHeatFire();else r.startFireShot();}
            if(r.weaponSet==='leaf_snake'&&e.code===r.controls.attack)r.startGreen('snake');
            if (r.weaponSet === 'cut_concrete' && e.code === r.controls.attack) {
                if (r.keys['KeyE']||r.keys['KeyQ']) r.startConcrete('build_far');
                else if (r.keys[r.controls.crouch]) r.startConcrete('build_near');
                else if (r.keys[r.controls.right]) r.startConcrete('moving');
            }
            if (e.code === r.controls.kickLight) { if (r.weaponSet === 'cut_concrete') r.startRollingCutter((r.keys['KeyE']||r.keys['KeyQ'])?'upper':'lower'); else if(r.weaponSet === 'fire')r.startFlameSword();else if(r.weaponSet==='leaf_snake')r.startGreen('bomb');else r.startSlashClaw(); }

            if (e.code === r.controls.kickHeavy) {
                if(r.weaponSet==='leaf_snake'&&r.leafShield&&!r.leafShield.thrown){
                    const dx=(r.keys[r.controls.right]?1:0)-(r.keys[r.controls.left]?1:0);
                    const dy=(r.keys['KeyS']?1:0)-(r.keys['KeyW']?1:0);
                    const diagonalLeft=r.keys['KeyQ'],diagonalRight=r.keys['KeyE'];
                    if(diagonalLeft||diagonalRight||dx||dy)r.launchLeaf(diagonalLeft?-1:diagonalRight?1:dx,diagonalLeft||diagonalRight?-1:dy);
                }else if(r.weaponSet==='leaf_snake'&&!r.leafShield&&!r.keys[r.controls.left]&&!r.keys[r.controls.right]&&!r.keys[r.controls.crouch])r.startGreen('leaf');
                else if(r.keys[r.controls.crouch] && r.isGrounded) r.startRushCoil();
                else if(r.keys[r.controls.left]||r.keys[r.controls.right])r.startRushJet(r.keys[r.controls.right]?1:-1);
            }
        }

        // ================================================================
        // ZERO - prueba del Z-Saber (Buster temporalmente fuera)
        // J = Slash A | I = Slash B | K = Slash C
        // ================================================================
        if (!e.repeat && p1 instanceof Zero) {
            if (e.code === p1.controls.attack && p1.isGrounded) p1.startSaberAttack('A');
            if (e.code === p1.controls.heavy && p1.isGrounded) p1.startSaberAttack('B');
            if (e.code === p1.controls.kickHeavy) p1.startSaberAttack(p1.isGrounded ? 'C' : 'AIR');
        }
        if (!e.repeat && p2 instanceof Zero) {
            if (e.code === p2.controls.attack && p2.isGrounded) p2.startSaberAttack('A');
            if (e.code === p2.controls.heavy && p2.isGrounded) p2.startSaberAttack('B');
            if (e.code === p2.controls.kickHeavy) p2.startSaberAttack(p2.isGrounded ? 'C' : 'AIR');
        }

        // Movimiento común + Spin Dash para cualquier personaje que lo soporte.
        if (e.code === p1.controls.left && !p1.lastDirectionState.left) {
            p1.checkDoubleTap("left", p2.x);
            p1.lastDirectionState.left = true;
        }
        if (e.code === p1.controls.right && !p1.lastDirectionState.right) {
            p1.checkDoubleTap("right", p2.x);
            p1.lastDirectionState.right = true;
        }
        if (p1.supportsSpin && e.code === p1.controls.spinKey && p1.isCrouching && !e.repeat) {
            p1.chargeSpinDash(p2.x, e.code);
        }

        // ================================================================
        // P2 (Espio)
        // ================================================================
        const p2OpponentIsRight = p1.x > p2.x;
        const p2Toward = p2OpponentIsRight ? 'ArrowRight' : 'ArrowLeft';
        const p2Backward = p2OpponentIsRight ? 'ArrowLeft' : 'ArrowRight';

        if (e.code === p2.controls.left && !p2.lastDirectionState.left) {
            p2.checkDoubleTap("left", p1.x);
            p2.lastDirectionState.left = true;
        }
        if (e.code === p2.controls.right && !p2.lastDirectionState.right) {
            p2.checkDoubleTap("right", p1.x);
            p2.lastDirectionState.right = true;
        }

        if (p2.supportsSpin && e.code === p2.controls.spinKey && p2.isCrouching && !e.repeat) {
            p2.chargeSpinDash(p1.x, e.code);
        }

        if (!e.repeat && p2 instanceof Espio) {
            if (e.code === 'Comma') {
                if (p2.keys[p2Toward]) {
                    p2.startTongueAttack("forward", p1.x);
                } else if (p2.keys['KeyQ'] || p2.keys['KeyE']) {
                    p2.startTongueAttack("up", p1.x);
                } else {
                    p2.startJab();
                }
            }

            if ((e.code === 'KeyQ' || e.code === 'KeyE') && p2.keys['Comma']) {
                p2.startTongueAttack("up", p1.x);
            }

            if (e.code === 'Period') {
                p2.startHeavy();
            }

            if (e.code === 'Minus') {
                if (p2.keys['ArrowUp'] && p2.keys[p2Backward]) {
                    if (!p2.isThrowingShuriken) {
                        p2.isThrowingShuriken = true;
                        p2.shurikenTimer = 0;
                        p2.shurikenWindup = 5;
                    }
                } else {
                    p2.startKickLight();
                }
            }

            if (e.code === 'Equal') {
                const now = performance.now();
                const recentBackRelease = p2.lastBackReleaseTime && (now - p2.lastBackReleaseTime < 300);

                if (p2.isGrounded && !p2.isBusy() && recentBackRelease && p2.keys[p2Toward]) {
                    p2.lastBackReleaseTime = 0;
                    if (!p2.isThrowingKunai) {
                        p2.isThrowingKunai = true;
                        p2.kunaiTimer = 0;
                    }
                } else {
                    p2.startKickHeavy();
                }
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        for(const f of [game.p1,game.p2])if(f instanceof Shadow&&e.code===f.controls.heavy)f.releaseChaosMagic();

        if (game.gameState !== GAME_STATE.BATTLE) return;
        if (!game.p1 || !game.p2) return;

        const p1 = game.p1;
        const p2 = game.p2;

        for (const [fighter, opponent] of [[p1,p2],[p2,p1]]) {
            if (fighter.hasBuster && !(fighter instanceof Rock && (fighter.weaponSet === 'cut_concrete'||fighter.weaponSet === 'fire'||fighter.weaponSet === 'leaf_snake')) && e.code === fighter.controls.attack && fighter.busterCharging) {
                const level = getBusterLevel(fighter);
                fighter.busterChargeLevel = level;
                const direction = opponent.x > fighter.x ? 1 : -1;
                game.projectiles.push(new BusterProjectile(fighter, level, direction));
                if (typeof fighter.onBusterFired === 'function') fighter.onBusterFired(level, direction);
                fighter.busterCharging = false;
                fighter.busterChargeStart = 0;
            }
        }

        // Spin cancel: al soltar agacharse sosteniendo direccion OPUESTA al lanzamiento,
        // la carga se cancela sin dash. Si hay fuego en contacto, comienza a extinguirse.
        for(const fighter of [p1,p2])if(e.code===fighter.controls.crouch){
          const opposite=fighter.spinDirection>0?fighter.controls.left:fighter.controls.right;
          if(fighter.isSpinning&&fighter.spinChargeLevel>0&&fighter.keys[opposite]){
            fighter.stopSpinChargeSound?.();fighter.isSpinning=false;fighter.isSpinDashActive=false;
            fighter.spinChargeLevel=0;fighter.vx=0;
            for(const rock of [p1,p2])if(rock instanceof Rock&&rock!==fighter){
              for(const fx of rock.fireEffects||[])if(fx.kind==='ground'&&fx.active&&Math.abs(fx.x-(fighter.x+fighter.width/2))<fighter.width*.65+fx.scale*18){fx.state='extinguishing';fx.stateAt=performance.now();}
            }
          }else fighter.releaseSpinDash();
        }

        const p1OpponentIsRight = p2.x > p1.x;
        const p1Backward = p1OpponentIsRight ? 'KeyA' : 'KeyD';
        if (e.code === p1Backward) {
            if (p1.isGrounded) p1.lastBackReleaseTime = performance.now();
        }

        const p2OpponentIsRight = p1.x > p2.x;
        const p2Backward = p2OpponentIsRight ? 'ArrowLeft' : 'ArrowRight';
        if (e.code === p2Backward) {
            if (p2.isGrounded) p2.lastBackReleaseTime = performance.now();
        }

        if (e.code === p1.controls.left) p1.lastDirectionState.left = false;
        if (e.code === p1.controls.right) p1.lastDirectionState.right = false;
        if (e.code === p2.controls.left) p2.lastDirectionState.left = false;
        if (e.code === p2.controls.right) p2.lastDirectionState.right = false;

        p1.keys[e.code] = false;
        p2.keys[e.code] = false;
    });
}