import { setInputDevice } from './input-labels.js';
import { chooseBattleStage } from './battle-stages.js';
import { music } from './music.js';
import { adventureKey } from './story-platform.js';
import { openStoryCampaigns } from './story-mode.js';
import { sonicWalkKey } from './sonic-chapter.js';
import { combatNow } from './combat-clock.js';
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
import { Knuckles } from './knuckles.js?v=knuckles-moves-3';
import { Bass, Treble } from './bass.js';
import { startBattle, returnToCharacterSelect, switchTeamFighter, chooseTrainingTeams } from './battle.js?v=palette-system-1';
import { BusterProjectile, getBusterLevel } from './buster-system.js';
import { getTouchedWall } from './wall-system.js';
import { selectionIndexAt, canRandomizeSelection, randomSelectionAt } from './selection.js';
import { openTournamentMenu, tournamentRunning, tournamentSimulationActive, cancelTournament } from './tournament.js?v=round-robin-snapshots-1';
import { modeOptionAt, resultActionAt } from './menu-screen.js?v=online-3v3-2';
import { requestTeamAssist } from './team-assists.js';
import { handleChaosPuddleKey, handleChaosPuddlePointer } from './chaos.js';
import { isBattleHelpOpen, toggleBattlePause } from './pause-menu.js?v=knuckles-moves-3';
import { openCharacterGuide, isCharacterGuideOpen, guideButtonAt } from './character-guide.js';
import { openOnlineLobby, handleOnlineSelectionKey, releaseOnlineInputs, routeOnlineKey } from './online.js?v=palette-system-1';
import { getSelectionPalette } from './character-palettes.js?v=palette-exact-4';

function isHumanInputForCpu(event) {
    if (!event.isTrusted && !event.gamepadInput) return false;
    const red = Object.values(game.p2.controls).includes(event.code) || ['BracketLeft', 'BracketRight', 'Quote'].includes(event.code);
    return Boolean(red ? game.cpuAgentP2 : game.cpuAgentP1);
}

function confirmSelectionAndStart() {
    const s = game.characterSelection;
    if (s.p1Confirmed && s.p2Confirmed) chooseBattleStage(game, startBattle);
}

// Extiende los básicos de personajes que aún no tienen una cadena nativa.
// El siguiente toque solo cancela recuperación si el golpe anterior conectó.
const BASIC_COMBOS = {
    espio: { button:'attack', hit:f=>f.jabHitDone, next:[f=>f.startKickLight(), f=>f.startKickHeavy()], clear:f=>{f.isJabActive=false;f.isKickLightActive=false;f.isKickHeavyActive=false;} },
    knuckles: { button:'attack', hit:f=>f.kHit, next:[f=>f.startPunch2(), f=>f.startUpper()], clear:f=>{f.kAction=null;f.kHit=false;f.facingLocked=false;} },
    emerl: { button:'attack', hit:f=>Boolean(f.robotMove?.hit), next:[f=>f.startEmerlMove('upper'), f=>f.startEmerlMove('roundhouse')], clear:f=>{f.robotMove=null;} },
    rock: { button:'kickLight', hit:f=>f.slashHit, next:[f=>f.startSlashClaw(), f=>f.startSlashClaw()], clear:f=>{f.slashActive=false;f.slashHit=false;f.facingLocked=false;} },
    x: { button:'kickLight', hit:f=>Boolean(f.saber?.hit || f.robotMove?.hit), next:[f=>f.saberDrawn?f.startSaber():f.startPhysical('kick'), f=>f.saberDrawn?f.startSaber():f.startPhysical('heavyKick')], clear:f=>{f.saber=null;f.robotMove=null;f.facingLocked=false;} },
    zero: { button:'attack', hit:f=>f.zeroAttackHit, next:[f=>f.startSaberAttack('B'), f=>f.startSaberAttack('C')], clear:f=>{f.zeroAttack=null;f.zeroAttackHit=false;f.facingLocked=false;} },
    bass: { button:'kickLight', hit:f=>Boolean(f.robotMove?.hit), next:[f=>f.startRobotAction('punch'), f=>f.startRobotAction('kick')], clear:f=>{f.robotMove=null;} },
    protoman: { button:'kickLight', hit:f=>Boolean(f.robotMove?.hit), next:[f=>f.startRobotAction('punch'), f=>f.startRobotAction('bash')], clear:f=>{f.robotMove=null;} }
};

function handleBasicCombo(fighter, code) {
    const combo=BASIC_COMBOS[fighter.characterId];
    const auxLeft=fighter===game.p1?'KeyQ':'BracketLeft';
    const auxRight=fighter===game.p1?'KeyE':'BracketRight';
    if (!combo || code!==fighter.controls[combo.button] || fighter.keys[fighter.controls.crouch] ||
        fighter.keys[fighter.controls.left] || fighter.keys[fighter.controls.right] || fighter.keys[fighter.controls.jump] ||
        fighter.keys[auxLeft] || fighter.keys[auxRight]) return false;
    const now=combatNow();
    const chain=fighter.basicCombo;
    if (chain && chain.code===code && now<=chain.expires && chain.step>0) {
        if (!combo.hit(fighter)) { fighter.basicCombo=null; return false; }
        combo.clear(fighter);
        const start=combo.next[chain.step-1];
        if (!start || !start(fighter)) { fighter.basicCombo=null; return false; }
        chain.step++;
        chain.expires=now+720;
        if (chain.step>combo.next.length) fighter.basicCombo=null;
        return true;
    }
    fighter.basicCombo={code,step:1,expires:now+720};
    return false;
}

function startRandomBattle() {
    const [blue, red] = chooseTrainingTeams();
    if (game.mode === 'team') { game.teamRosters = [blue, red]; game.teamPaletteRosters=[blue.map(()=>0),red.map(()=>0)]; }
    const s = game.characterSelection;
    s.p1Index = s.chars.indexOf(blue[0]);
    s.p2Index = s.chars.indexOf(red[0]);
    s.p1Confirmed = true;
    s.p2Confirmed = true;
    chooseBattleStage(game, startBattle);
}

function confirmFighter(side) {
    const selection = game.characterSelection;
    if (game.mode === 'team') {
        const roster = game.teamRosters[side === 'p1' ? 0 : 1];
        const id = selection.chars[selection[side + 'Index']];
        if (roster.includes(id)) return;
        const otherIndex = game.teamRosters[side === 'p1' ? 1 : 0].indexOf(id);
        let palette = getSelectionPalette(selection,side);
        const otherPalette = game.teamPaletteRosters?.[side === 'p1' ? 1 : 0]?.[otherIndex];
        if (otherIndex >= 0 && otherPalette === palette) palette ^= 1;
        roster.push(id);
        game.teamPaletteRosters[side === 'p1' ? 0 : 1].push(palette);
        if (roster.length < 3) return;
    } else {
        const other = side === 'p1' ? 'p2' : 'p1';
        const id = selection.chars[selection[side + 'Index']];
        const otherId = selection.chars[selection[other + 'Index']];
        selection[side+'Palette']=getSelectionPalette(selection,side);
        if (selection[other + 'Confirmed'] && id === otherId &&
            selection[side + 'Palette'] === selection[other + 'Palette']) {
            selection[side + 'Palette'] = selection[other + 'Palette'] ^ 1;
        }
    }
    selection[side + 'Confirmed'] = true;
}

function toggleSelectionPalette(side) {
    const s=game.characterSelection;
    if (!s[side+'Confirmed']) s[side+'Palette'] = getSelectionPalette(s,side) ^ 1;
}

function chooseMode(index) {
    if (index === 5) { openTournamentMenu(); return; }
    if (index === 6) { openOnlineLobby(); return; }
    if (index === 3) { openStoryCampaigns(); return; }
    game.controlOverrides = null;
    game.modeCursor = index;
    game.mode = ['cpu', 'local', 'team', 'story', 'practice'][index];
    game.gameState = GAME_STATE.SELECT;
    game.teamRosters = [[], []];
    game.teamPaletteRosters = [[], []];
    game.characterSelection.p1Confirmed = false;
    game.characterSelection.p2Confirmed = false;
}

function handleResultAction(action) {
    if (action === 'rematch') startBattle();
    else if (action === 'characters') returnToCharacterSelect();
}

function canvasPoint(event) {
    const canvas = document.getElementById('gameCanvas');
    const rect = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height
    };
}

const assistKeys = new Map();
const TAG_HOLD_MS = 350;

export function tickAssistKeys(now) {
    for (const [key, press] of assistKeys) {
        if (now - press.started < TAG_HOLD_MS) continue;
        assistKeys.delete(key);
        if (game[press.side] === press.fighter) switchTeamFighter(press.side, { slot: press.slot });
    }
}

export function setupInput() {
    window.addEventListener('blur', () => {
        assistKeys.clear();
        if (game.mode==='online') { releaseOnlineInputs(); return; }
        for (const fighter of [game.p1, game.p2]) {
            if (!fighter) continue;
            for (const key of Object.keys(fighter.keys)) fighter.keys[key] = false;
            if (fighter.lastDirectionState) {
                fighter.lastDirectionState.left = false;
                fighter.lastDirectionState.right = false;
            }
            fighter.busterCharging = false;
            fighter.busterChargeStart = 0;
        }
    });
    window.addEventListener('keydown', (e) => {
        if (e.isTrusted) {
            const red = /^Arrow|^(Comma|Period|Minus|Equal|BracketLeft|BracketRight|Quote|Slash)$/.test(e.code);
            setInputDevice(red && game.mode!=='online' ? 'p2' : 'p1','keyboard');
        }
        if (game.mode==='online' && (game.gameState===GAME_STATE.BATTLE || isBattleHelpOpen()) && e.code==='Escape' &&
            (e.isTrusted || e.gamepadInput)) {
            e.preventDefault();
            if (!e.repeat) {
                if (!isBattleHelpOpen()) { assistKeys.clear(); releaseOnlineInputs(); }
                toggleBattlePause();
            }
            return;
        }
        if (game.mode==='online' && isBattleHelpOpen() && !e.__onlineForwarded) return;
        if (routeOnlineKey(e)) return;
        if(e.isTrusted && tournamentRunning() && e.code==='Escape') { e.preventDefault();cancelTournament();return; }
        if(e.isTrusted && tournamentSimulationActive()) return;
        music.unlock();
        if (sonicWalkKey(e, true) || adventureKey(e, true)) return;
        if (isCharacterGuideOpen() || game.gameState === GAME_STATE.STORY) return;
        if (game.gameState === GAME_STATE.BATTLE && e.code === 'Escape' && (e.isTrusted || e.gamepadInput)) {
            e.preventDefault();
            if (!e.repeat) toggleBattlePause();
            return;
        }
        if (game.paused) return;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') return;
        if (e.code === 'Space' || e.code === 'Enter' ||
            (game.gameState === GAME_STATE.SELECT && e.code.startsWith('Arrow')) ||
            (game.gameState === GAME_STATE.MODE && e.code.startsWith('Arrow'))) e.preventDefault();

        if (game.gameState === GAME_STATE.MODE) {
            if(tournamentRunning()) return;
            if (e.code === 'KeyG' && !e.repeat) { openCharacterGuide(); return; }
            if (!e.repeat && ['KeyA', 'ArrowLeft'].includes(e.code)) game.modeCursor = (game.modeCursor + 6) % 7;
            if (!e.repeat && ['KeyD', 'ArrowRight'].includes(e.code)) game.modeCursor = (game.modeCursor + 1) % 7;
            if (!e.repeat && ['KeyJ', 'Comma', 'Space', 'Enter'].includes(e.code)) chooseMode(game.modeCursor);
            return;
        }

        if (game.gameState === GAME_STATE.RESULT) {
            if (!e.repeat && ['KeyR', 'Enter'].includes(e.code)) handleResultAction('rematch');
            if (!e.repeat && ['KeyC', 'Escape'].includes(e.code)) handleResultAction('characters');
            return;
        }

        // ============================
        // SELECCIÓN
        // ============================
        if (game.gameState === GAME_STATE.SELECT) {
            if (handleOnlineSelectionKey(e)) return;
            if (e.code === 'KeyI' && !e.repeat) toggleSelectionPalette('p1');
            if (e.code === 'Period' && !e.repeat) toggleSelectionPalette('p2');
            if (e.code === 'KeyR' && !e.repeat && canRandomizeSelection()) {
                startRandomBattle();
                return;
            }
            if (e.code === 'Escape' && !e.repeat) {
                game.gameState = GAME_STATE.MODE;
                return;
            }
            const chars = game.characterSelection.chars;

            if (!game.characterSelection.p1Confirmed) {
                if (e.code === 'KeyA' && !e.repeat) {
                    const i = game.characterSelection.p1Index;
                    const row = Math.floor(i / 4), col = i % 4;
                    const rowSize = Math.min(4, chars.length - row * 4);
                    game.characterSelection.p1Index = row * 4 + (col + rowSize - 1) % rowSize;
                }
                if (e.code === 'KeyD' && !e.repeat) {
                    const i = game.characterSelection.p1Index;
                    const row = Math.floor(i / 4), col = i % 4;
                    const rowSize = Math.min(4, chars.length - row * 4);
                    game.characterSelection.p1Index = row * 4 + (col + 1) % rowSize;
                }
                if ((e.code === 'KeyW' || e.code === 'KeyS') && !e.repeat) {
                    const i = game.characterSelection.p1Index;
                    const col = i % 4, row = Math.floor(i / 4), rows = Math.ceil(chars.length / 4);
                    const nextRow = (row + (e.code === 'KeyW' ? rows - 1 : 1)) % rows;
                    let next = nextRow * 4 + col;
                    if (next >= chars.length) next = (nextRow * 4) + (col % (chars.length - nextRow * 4));
                    game.characterSelection.p1Index = next;
                }
                if (e.code === 'KeyJ' && !e.repeat) {
                    confirmFighter('p1');
                }
            }

            if (!game.characterSelection.p2Confirmed) {
                if (e.code === 'ArrowLeft' && !e.repeat) {
                    const i = game.characterSelection.p2Index;
                    const row = Math.floor(i / 4), col = i % 4;
                    const rowSize = Math.min(4, chars.length - row * 4);
                    game.characterSelection.p2Index = row * 4 + (col + rowSize - 1) % rowSize;
                }
                if (e.code === 'ArrowRight' && !e.repeat) {
                    const i = game.characterSelection.p2Index;
                    const row = Math.floor(i / 4), col = i % 4;
                    const rowSize = Math.min(4, chars.length - row * 4);
                    game.characterSelection.p2Index = row * 4 + (col + 1) % rowSize;
                }
                if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && !e.repeat) {
                    const i = game.characterSelection.p2Index;
                    const col = i % 4, row = Math.floor(i / 4), rows = Math.ceil(chars.length / 4);
                    const nextRow = (row + (e.code === 'ArrowUp' ? rows - 1 : 1)) % rows;
                    let next = nextRow * 4 + col;
                    if (next >= chars.length) next = (nextRow * 4) + (col % (chars.length - nextRow * 4));
                    game.characterSelection.p2Index = next;
                }
                if (e.code === 'Comma' && !e.repeat) {
                    confirmFighter('p2');
                }
            }

            confirmSelectionAndStart();

            return;
        }

        // ============================
        // BATALLA
        // ============================
        if (game.gameState !== GAME_STATE.BATTLE) return;
        if (!game.p1 || !game.p2) return;
        if (isHumanInputForCpu(e)) return;
        if (game.countdown && game.countdown.phase !== '0' && game.countdown.phase !== 'go') return;

        const p1 = game.p1;
        const p2 = game.p2;

        if (!e.repeat && handleChaosPuddleKey(e.code)) return;

        if (game.teamFighters && !e.repeat) {
            if (e.code === 'KeyU' || e.code === 'Quote') {
                const side = e.code === 'KeyU' ? 'p1' : 'p2';
                const fighter = game[side];
                assistKeys.set(e.assistSlot == null ? e.code : e.code + e.assistSlot, { side, fighter, started: combatNow(),
                    slot: e.assistSlot ?? Number(Boolean(fighter.keys[fighter.controls.crouch])) });
                return;
            }
            if (e.code === 'KeyL') { switchTeamFighter('p1'); return; }
            if (e.code === 'Slash') { switchTeamFighter('p2'); return; }
        }

        // ROCK — doble abajo abre el mini selector; el tercer input selecciona.
        // abajo+abajo+arriba = CUT/CONCRETE; abajo+abajo+abajo = BASE.
        for (const r of [p1,p2]) {
            if (r.characterId === 'rock' && !e.repeat && r.handleWeaponSelectorInput(e.code)) return;
        }

        // Rebote de pared con el botón de salto para quienes tienen esa técnica.
        for (const [fighter, opponent] of [[p1,p2],[p2,p1]]) {
            if (e.code === fighter.controls.jump && !e.repeat && !fighter.isGrounded) {
                const wall = getTouchedWall(fighter);
                if (wall && !fighter.airMobilityLocked && !(fighter.wallDetachUntil>combatNow()) && (!['metal-sonic','megaman-zero'].includes(fighter.characterId) || !fighter.isBusy())) {
                    fighter.vy = fighter.jumpForce;
                    // Zigzag de pared: se despega visual/físicamente un poco hacia el lado
                    // contrario y la gravedad/movimiento lo deja volver a tocar el pilar.
                    fighter.vx = wall.side === 'left' ? 7 : -7;
                    fighter.wallSliding = false;
                    fighter.startWallHop?.(wall.side);
                }
            }
        }

        // Buster universal de robots: mantener ataque para cargar, soltar para disparar.
        for (const fighter of [p1,p2]) {
            if (fighter.hasBuster && (fighter.canUseBuster?.() ?? true) && !(fighter instanceof Rock && (fighter.weaponSet === 'cut_concrete'||fighter.weaponSet === 'fire'||fighter.weaponSet === 'leaf_snake')) && e.code === (fighter instanceof Zero ? fighter.controls.kickLight : fighter.controls.attack) && !e.repeat && !fighter.busterCharging) {
                fighter.busterCharging = true;
                fighter.busterChargeStart = combatNow();
                fighter.busterChargeLevel = 1;
            }
        }

        p1.keys[e.code] = true;
        p2.keys[e.code] = true;

        for (const [k,opp] of [[p1,p2],[p2,p1]]) {
            if (!(k instanceof Knuckles) || e.repeat) continue;
            const toward = opp.x > k.x ? k.controls.right : k.controls.left;
            const back = toward === k.controls.right ? k.controls.left : k.controls.right;
            const down = k.keys[k.controls.crouch];
            const forward = k.keys[toward];
            const backward = k.keys[back];
            const special = e.code === k.controls.heavy
                ? (down ? 'lowCounter' : forward ? 'grab2' : backward ? 'parry' : null)
                : e.code === k.controls.kickLight
                    ? (down ? 'ken' : backward ? 'parry' : forward ? 'last' : null)
                    : e.code === k.controls.attack
                        ? (forward && down ? 'mega' : backward ? 'taunt' : forward ? 'charged' : null)
                        : e.code === k.controls.kickHeavy && forward && !down && k.isGrounded ? 'headbutt' : null;
            if (!k.isGrounded && e.code===k.controls.attack && !k.glide) {k.startSpecial('airPunch',toward===k.controls.right?1:-1); continue;}
            if (special && k.isGrounded) { k.startSpecial(special,toward===k.controls.right?1:-1); continue; }
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
                else k.startFloorPunch();
            }
        }

        if (!e.repeat) for (const fighter of [p1,p2]) {
            if (handleBasicCombo(fighter,e.code)) return;
        }

        for (const [fighter, target] of [[p1,p2],[p2,p1]]) {
            if (e.repeat) continue;
            if (fighter.characterId === 'megaman-zero') fighter.chooseAttack(e.code,target);
            if (fighter.characterId === 'silver') fighter.command(e.code,target);
            if (fighter.characterId === 'chaos') fighter.handleCommand(e.code, target);
            if (fighter.characterId === 'tails') fighter.handleCommand(e.code, target);
            if (fighter.characterId === 'sonic' && fighter.handleSonicCommand(e.code,target)) return;
            if (fighter.characterId === 'wily' && fighter.commandWily(e.code,target)) return;
            if (fighter.characterId === 'eggman' && fighter.command(e.code, target)) return;
            if (fighter.characterId === 'metal-sonic' && fighter.handleMetalCommand(e.code, target)) return;
        }

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
        for (const [bass, opponent] of [[p1, p2], [p2, p1]]) {
            if (!(bass instanceof Bass) || bass.state === 'intro' || e.repeat) continue;
            if (opponent.grabConnected && !opponent.grabThrown && opponent.grabTarget === bass) continue;
            const toward = opponent.x > bass.x ? bass.controls.right : bass.controls.left;
            const backward = opponent.x > bass.x ? bass.controls.left : bass.controls.right;
            const jumpHeld = Boolean(bass.keys[bass.controls.jump]);
            if (e.code === bass.controls.attack) {
                const vertical = jumpHeld ? 'up' : 'neutral';
                const horizontal = bass.keys[toward] ? 'forward' : bass.keys[backward] ? 'forward' : 'neutral';
                bass.tryShoot(vertical, horizontal);
            }
            const aimLeft = bass === p1 ? 'KeyQ' : 'BracketLeft';
            const aimRight = bass === p1 ? 'KeyE' : 'BracketRight';
            if (e.code === aimLeft || e.code === aimRight) {
                const direction = e.code === aimRight ? 1 : -1;
                if (jumpHeld || !bass.isGrounded) bass.startJet(direction, true);
                else if (direction === (toward === bass.controls.right ? 1 : -1)) bass.tryShoot('up', 'forward');
            }
            if (e.code === bass.controls.heavy && (!bass.activeTreble || !bass.activeTreble.isActive)) {
                bass.summonTreble(opponent.x);
            }
            if (e.code === bass.controls.spinKey) {
                const horizontal = (jumpHeld || !bass.isGrounded) && Boolean(bass.keys[toward] || bass.keys[backward]);
                const direction = horizontal ? (bass.keys[bass.controls.right] ? 1 : -1) : bass.facingLeft ? -1 : 1;
                bass.startJet(direction, horizontal);
            }
            if (e.code === bass.controls.kickLight && bass.keys[bass.controls.crouch]) bass.startBarrier();
            else if (e.code === bass.controls.kickLight) bass.startRobotAction('punch');
            if (e.code === bass.controls.kickHeavy) bass.startRobotAction(bass.keys[backward] ? 'dodge' : 'kick');
        }

        if (!e.repeat) for (const fighter of [p1, p2]) {
            if (fighter.characterId !== 'emerl' || !fighter.startEmerlMove) continue;
            if (e.code === fighter.controls.attack && !fighter.hasBuster) fighter.startEmerlMove('punch');
            if (fighter.rockCopyEnabled) continue;
            if (e.code === fighter.controls.heavy) fighter.startEmerlMove('waveKick');
            if (e.code === fighter.controls.kickLight) fighter.startEmerlMove('upper');
            if (e.code === fighter.controls.kickHeavy) fighter.startEmerlMove(fighter.isGrounded ? 'roundhouse' : 'rocket');
        }

        if (!e.repeat) for (const [proto, opponent] of [[p1, p2], [p2, p1]]) {
            if (proto.characterId !== 'protoman' || (opponent.grabConnected && !opponent.grabThrown && opponent.grabTarget === proto)) continue;
            const back = opponent.x > proto.x ? proto.controls.left : proto.controls.right;
            if (e.code === proto.controls.kickLight) {
                const attack = proto.keys[proto.controls.crouch] ? 'sweep' : proto.keys[proto.controls.heavy] ? 'strike' : 'punch';
                proto.startRobotAction(attack);
            }
            if (e.code === proto.controls.kickHeavy) {
                const forward = opponent.x > proto.x ? proto.controls.right : proto.controls.left;
                const powered = Boolean(proto.keys[proto.controls.heavy]);
                if (proto.keys[proto.controls.crouch]) proto.startShieldThrow(opponent,.55,powered);
                else if (proto.keys[proto.controls.jump]) proto.startShieldThrow(opponent,-.55,powered);
                else if (proto.keys[forward] || powered) proto.startShieldThrow(opponent,0,powered);
                else proto.startRobotAction(proto.keys[back] ? 'dodge' : 'bash');
            }
        }
        if (!e.repeat) for (const fighter of [p1, p2]) {
            if (fighter.characterId !== 'x') continue;
            const down = fighter.keys[fighter.controls.crouch];
            const up = fighter.keys[fighter.controls.jump];
            const forward = fighter.facingDirection > 0 ? fighter.controls.right : fighter.controls.left;
            if (e.code === (fighter === p1 ? 'KeyQ' : 'BracketLeft')) fighter.toggleSaber();
            if (e.code === (fighter === p1 ? 'KeyE' : 'BracketRight')) fighter.startPhysical('hado');
            if (e.code === fighter.controls.kickLight) {
                if (fighter.saberDrawn) {
                    if (fighter.isDashing || (fighter.isGrounded && fighter.keys[forward])) fighter.startSwordMove('sDashCut');
                    else if (down && !fighter.isGrounded) fighter.startSwordMove('sDive');
                    else fighter.startSaber(down ? 'low' : 'normal');
                }
                else fighter.startPhysical(!fighter.isGrounded ? 'airPunch' : down ? 'lowPunch' : 'jab');
            }
            if (e.code === fighter.controls.heavy) {
                if (fighter.saberDrawn) fighter.startSwordMove(fighter.isGrounded ? 'sUpper' : 'sSpin');
                else fighter.startPhysical(up ? 'upper' : !fighter.isGrounded ? 'airKick' : down ? 'lowKick' : 'kick');
            }
            if (e.code === fighter.controls.kickHeavy) {
                if (fighter.saberDrawn && down && fighter.isGrounded) fighter.startSwordMove('sGround');
                else fighter.startNova();
            }
        }

        // ================================================================
        // ESPIO
        // ================================================================
        if (p1 instanceof Espio && !e.repeat) {
            if (e.code === 'KeyJ' && p1.keys[p1.controls.crouch]) { p1.startCloak(); return; }
            if (p1.keys[p1.controls.crouch]) {
                const technique={KeyI:'drill',KeyM:'tornado',KeyK:'smoke'}[e.code];
                if (technique) { p1.startNinjaTechnique(technique,p2, technique === 'drill' &&
                    p1.keys[p1.x < p2.x ? p1.controls.right : p1.controls.left]); return; }
            }
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
                const now = combatNow();
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
            if (e.code===p1.controls.crouch) p1.toggleSonicSuper();
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
            if (e.code===p2.controls.crouch) p2.toggleSonicSuper();
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
            f.handleBattleTechnique(e.code,opp);
            if(e.code===f.controls.crouch)f.toggleSuperTap();
            if(e.code===f.controls.attack){
                f.startShadowChop();
            }
            if(e.code===f.controls.heavy){if(f.keys[f.controls.crouch])f.startChaosMagic();else f.startChaosNightmare();}
            if(e.code===f.controls.kickLight)f.startChaosUpper();
            if(e.code===f.controls.kickHeavy){
                if(f.brakeShadowTeleport())continue;
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


        // ================================================================
        // ROCK + RUSH + BEAT
        // I/Y = Beat Crescent
        // izquierda+derecha+I/Y = Beat Patrol horizontal
        // Durante Patrol, I/Y solicita el drop; sale al llegar al frame 15.
        // BASE: M/A = Slash Claw. CUT/CONCRETE: D+J móvil, S+J construcción cerca, E+J construcción lejos; M Cutter, E+M Cutter alto.
        // K/B = Rush Jet | abajo+K/B = Rush Coil
        // ================================================================
        for (const r of [p1,p2]) {
            if (!(r.characterId === 'rock' || r.rockCopyEnabled) || e.repeat) continue;
            const upLeft = r === p1 ? 'KeyQ' : 'BracketLeft';
            const upRight = r === p1 ? 'KeyE' : 'BracketRight';
            if (e.code === r.controls.heavy && r.keys[upRight]) { r.requestEddie(); continue; }
            if (e.code === r.controls.heavy) {
                if (r.releaseEddie()) continue;
                if (r.activeBeat?.state === 'patrol') r.requestBeatDrop();
                else if (r.keys[r.controls.left] && r.keys[r.controls.right]) r.startBeatPatrol();
                else r.startBeatCrescent();
            }
            if (r.weaponSet === 'fire' && e.code === r.controls.attack) {if(r.keys[upRight]||r.keys[upLeft])r.startHeatFire();else r.startFireShot();}
            if(r.weaponSet==='leaf_snake'&&e.code===r.controls.attack)r.startGreen('snake');
            if (r.weaponSet === 'cut_concrete' && e.code === r.controls.attack) {
                // J sola fija lejos; después J+D lanza el Concrete móvil para empujar al rival contra ella.
                if (r.keys[r.controls.right]) r.startConcrete('moving');
                else if (r.keys[r.controls.crouch]) r.startConcrete('build_near');
                else r.startConcrete('build_far');
            }
            if (e.code === r.controls.kickLight) { if (r.weaponSet === 'cut_concrete') r.startRollingCutter((r.keys[upRight]||r.keys[upLeft])?'upper':'lower'); else if(r.weaponSet === 'fire')r.startFlameSword();else if(r.weaponSet==='leaf_snake')r.startGreen('bomb');else r.startSlashClaw(); }

            if (e.code === r.controls.kickHeavy) {
                if(r.weaponSet==='leaf_snake'&&r.leafShield&&!r.leafShield.thrown){
                    const dx=(r.keys[r.controls.right]?1:0)-(r.keys[r.controls.left]?1:0);
                    const dy=(r.keys[r.controls.crouch]?1:0)-(r.keys[r.controls.jump]?1:0);
                    const diagonalLeft=r.keys[upLeft],diagonalRight=r.keys[upRight];
                    r.launchLeaf(diagonalLeft?-1:diagonalRight?1:(dx||(!dy?r.facingDirection:0)),
                        diagonalLeft||diagonalRight?-1:dy);
                }else if(r.weaponSet==='leaf_snake'&&!r.leafShield&&!r.keys[r.controls.left]&&!r.keys[r.controls.right]&&!r.keys[r.controls.crouch])r.startGreen('leaf');
                else if(r.keys[r.controls.crouch] && r.isGrounded) r.startRushCoil();
                else if(r.keys[r.controls.left]||r.keys[r.controls.right])r.startRushJet(r.keys[r.controls.right]?1:-1);
                else if(r.isGrounded)r.startRushCoil();
                else r.startRushJet(r.facingDirection);
            }
        }

        // ================================================================
        // ZERO - Z-Saber. El botón de patada ligera carga el Buster.
        // Adelante + ataque = corte de avance. Abajo + fuerte = corte ascendente.
        // ================================================================
        if (!e.repeat) for (const [zero, rival] of [[p1, p2], [p2, p1]]) {
            if (!(zero instanceof Zero)) continue;
            const c = zero.controls;
            const forward = rival.x + rival.width / 2 > zero.x + zero.width / 2 ? c.right : c.left;
            const aux1=zero.keys[zero===p1?'KeyQ':'BracketLeft'];
            const aux2=zero.keys[zero===p1?'KeyE':'BracketRight'];
            const wall=!zero.isGrounded&&getTouchedWall(zero);
            const down=zero.keys[c.crouch];
            if (e.code === c.attack && zero.isGrounded) {
                zero.startSaberAttack(aux1?'THRUST':aux2?'BURST':down?'CROUCH':zero.keys[forward]?'ADVANCE':'A');
            }
            if (e.code === c.heavy) {
                if(wall)zero.startSaberAttack('WALLKICK');
                else if(zero.isGrounded)zero.startSaberAttack(aux1?'FIREUP':aux2?'ELECUP':down?'UPPER':'B');
            }
            if (e.code === c.kickHeavy) {
                if(wall)zero.startSaberAttack('WALL');
                else if(!zero.isGrounded)zero.startSaberAttack(aux1?'ICEDIVE':aux2?'FIREDIVE':down?'AIRSPIN':'AIR');
                else zero.startSaberAttack(aux1?'FROSTDASH':down?'LAND':zero.keys[forward]?'SLIDE':'C');
            }
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
        if (p1.supportsSpin && e.code === p1.controls.spinKey && !e.repeat) {
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

        if (p2.supportsSpin && e.code === p2.controls.spinKey && !e.repeat) {
            p2.chargeSpinDash(p1.x, e.code);
        }

        if (!e.repeat && p2 instanceof Espio) {
            if (e.code === 'Comma' && p2.keys[p2.controls.crouch]) { p2.startCloak(); return; }
            if (p2.keys[p2.controls.crouch]) {
                const technique={Period:'drill',Minus:'tornado',Equal:'smoke'}[e.code];
                if (technique) { p2.startNinjaTechnique(technique,p1, technique === 'drill' &&
                    p2.keys[p2.x < p1.x ? p2.controls.right : p2.controls.left]); return; }
            }
            if (e.code === 'Comma') {
                if (p2.keys[p2Toward]) {
                    p2.startTongueAttack("forward", p1.x);
                } else if (p2.keys['BracketLeft'] || p2.keys['BracketRight']) {
                    p2.startTongueAttack("up", p1.x);
                } else {
                    p2.startJab();
                }
            }

            if ((e.code === 'BracketLeft' || e.code === 'BracketRight') && p2.keys['Comma']) {
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
                const now = combatNow();
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
        for (const fighter of [game.p1,game.p2]) fighter?.releaseAbsorb?.(e.code);
        if (game.mode==='online' && isBattleHelpOpen() && !e.__onlineForwarded) return;
        const assistKey = e.assistSlot == null ? e.code : e.code + e.assistSlot;
        const press = assistKeys.get(assistKey);
        if (press) {
            assistKeys.delete(assistKey);
            if (!game.paused && game.gameState === GAME_STATE.BATTLE && game[press.side] === press.fighter) {
                if (combatNow() - press.started >= TAG_HOLD_MS) switchTeamFighter(press.side, { slot: press.slot });
                else requestTeamAssist(press.side, press.slot);
            }
            return;
        }
        if (routeOnlineKey(e)) return;
        if (sonicWalkKey(e, false) || adventureKey(e, false)) return;
        if (game.paused) return;
        if (game.gameState === GAME_STATE.BATTLE && game.p1 && game.p2 && isHumanInputForCpu(e)) return;
        for(const f of [game.p1,game.p2])if(f instanceof Shadow&&e.code===f.controls.heavy)f.releaseChaosMagic();

        if (!game.p1 || !game.p2) return;

        const p1 = game.p1;
        const p2 = game.p2;

        p1.keys[e.code] = false;
        p2.keys[e.code] = false;
        for (const [fighter, target] of [[p1,p2],[p2,p1]]) {
            if (fighter.characterId === 'tails' && e.code === fighter.auxShot) fighter.releaseShot(target);
            if (fighter.characterId === 'megaman-zero' && game.gameState===GAME_STATE.BATTLE) fighter.releaseWeapon(e.code,target);
        }
        if (game.gameState !== GAME_STATE.BATTLE) return;
        if (game.countdown && game.countdown.phase !== '0' && game.countdown.phase !== 'go') return;

        for (const [fighter, opponent] of [[p1,p2],[p2,p1]]) {
            if (fighter.hasBuster && !(fighter instanceof Rock && (fighter.weaponSet === 'cut_concrete'||fighter.weaponSet === 'fire'||fighter.weaponSet === 'leaf_snake')) && e.code === (fighter instanceof Zero ? fighter.controls.kickLight : fighter.controls.attack) && fighter.busterCharging) {
                const level = getBusterLevel(fighter);
                if(fighter.canUseBuster && !fighter.canUseBuster()){
                    fighter.busterCharging=false;
                    fighter.busterChargeStart=0;
                    continue;
                }
                if (combatNow() < (fighter.nextBusterShotAt ?? 0)) {
                    fighter.busterCharging=false;
                    fighter.busterChargeStart=0;
                    continue;
                }
                fighter.nextBusterShotAt = combatNow() + 300;
                fighter.busterChargeLevel = level;
                const direction = opponent.x > fighter.x ? 1 : -1;
                const shot = new BusterProjectile(fighter, level, direction);
                game.projectiles.push(shot);
                fighter.onBusterFired?.(level, shot.direction);
                fighter.busterCharging = false;
                fighter.busterChargeStart = 0;
            }
        }

        // Al soltar abajo se elige la dirección. Atrás + botón de giro cancela la carga.
        for(const fighter of [p1,p2])if(e.code===fighter.controls.crouch){
          const opposite=fighter.spinDirection>0?fighter.controls.left:fighter.controls.right;
          if(fighter.isSpinning&&fighter.spinChargeLevel>0&&fighter.keys[opposite]&&fighter.keys[fighter.controls.spinKey]){
            fighter.stopSpinChargeSound?.();fighter.isSpinning=false;fighter.isSpinDashActive=false;
            fighter.spinChargeLevel=0;fighter.vx=0;
            for(const rock of [p1,p2])if(rock instanceof Rock&&rock!==fighter){
              for(const fx of rock.fireEffects||[])if(fx.kind==='ground'&&fx.active&&Math.abs(fx.x-(fighter.x+fighter.width/2))<fighter.width*.65+fx.scale*18){fx.state='extinguishing';fx.stateAt=combatNow();}
            }
          }else fighter.releaseSpinDash(Number(Boolean(fighter.keys[fighter.controls.right]))-
            Number(Boolean(fighter.keys[fighter.controls.left])));
        }

        const p1OpponentIsRight = p2.x > p1.x;
        const p1Backward = p1OpponentIsRight ? 'KeyA' : 'KeyD';
        if (e.code === p1Backward) {
            if (p1.isGrounded) p1.lastBackReleaseTime = combatNow();
        }

        const p2OpponentIsRight = p1.x > p2.x;
        const p2Backward = p2OpponentIsRight ? 'ArrowLeft' : 'ArrowRight';
        if (e.code === p2Backward) {
            if (p2.isGrounded) p2.lastBackReleaseTime = combatNow();
        }

        if (e.code === p1.controls.left) p1.lastDirectionState.left = false;
        if (e.code === p1.controls.right) p1.lastDirectionState.right = false;
        if (e.code === p2.controls.left) p2.lastDirectionState.left = false;
        if (e.code === p2.controls.right) p2.lastDirectionState.right = false;

    });

    const canvas = document.getElementById('gameCanvas');
    canvas.addEventListener('pointermove', (e) => {
        const p = canvasPoint(e);
        if (game.gameState === GAME_STATE.MODE) {
            if (guideButtonAt(p.x, p.y)) return;
            const mode = modeOptionAt(p.x, p.y);
            if (mode >= 0) game.modeCursor = mode;
            return;
        }
        if (game.gameState !== GAME_STATE.SELECT) return;
        if (game.mode === 'online') return;
        const s = game.characterSelection;
        const p1Index = selectionIndexAt(p.x, p.y, 1);
        const p2Index = selectionIndexAt(p.x, p.y, 2);
        if (!s.p1Confirmed && p1Index >= 0) s.p1Index = p1Index;
        if (!s.p2Confirmed && p2Index >= 0) s.p2Index = p2Index;
    });

    canvas.addEventListener('pointerdown', (e) => {
        music.unlock();
        const p = canvasPoint(e);
        if (game.gameState === GAME_STATE.MODE) {
            if(tournamentRunning()) return;
            if (guideButtonAt(p.x, p.y)) { openCharacterGuide(); return; }
            const mode = modeOptionAt(p.x, p.y);
            if (mode >= 0) chooseMode(mode);
            return;
        }
        if (!game.paused && game.gameState === GAME_STATE.BATTLE && handleChaosPuddlePointer(p.x,p.y)) return;
        if (game.gameState === GAME_STATE.RESULT) {
            const action = resultActionAt(p.x, p.y);
            if (action) handleResultAction(action);
            return;
        }
        if (game.gameState !== GAME_STATE.SELECT) return;
        if (game.mode === 'online') return;
        if (randomSelectionAt(p.x, p.y)) {
            startRandomBattle();
            return;
        }
        const s = game.characterSelection;
        const p1Index = selectionIndexAt(p.x, p.y, 1);
        const p2Index = selectionIndexAt(p.x, p.y, 2);
        if (p1Index >= 0 && !s.p1Confirmed) { s.p1Index = p1Index; confirmFighter('p1'); }
        else if (p2Index >= 0 && !s.p2Confirmed) { s.p2Index = p2Index; confirmFighter('p2'); }
        confirmSelectionAndStart();
    });
}

export function dispatchCpuTap(code) {
    if (game.paused || game.gameState !== GAME_STATE.BATTLE || !['0', 'go'].includes(game.countdown?.phase)) return;
    window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    window.setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })), 90);
}
