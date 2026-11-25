import { DEFAULT_ROUND_SECONDS, normalizeRoundSeconds } from './battle-stages.js';
import { resetTeamAssists } from './team-assists.js';
import { resetEggmanSupports } from './eggman-supports.js';
import { resetWind } from './wind-effects.js';
import { music } from './music.js';
import { StoryRobot } from './story-robot.js';
import { combatNow } from './combat-clock.js';
// ========================================
// INICIO DE BATALLA Y FÁBRICA DE FIGHTERS
// ========================================

import { setArenaGeometry, HIGHWAY_WALLS } from './wall-system.js';
import { GAME_STATE } from './config.js';
import { game } from './state.js';
import { Espio } from './espio.js';
import { Bass } from './bass.js';
import { Sonic } from './sonic.js';
import { Chaos } from './chaos.js';
import { Tails } from './tails.js';
import { MetalSonic } from './metal-sonic.js';
import { Shadow } from './shadow.js';
import { Knuckles } from './knuckles.js?v=knuckles-moves-3';
import { Silver } from './silver.js';
import { X } from './x.js';
import { Zero } from './zero.js';
import { Rock } from './rock.js';
import { ProtoMan } from './protoman.js';
import { Eggman } from './eggman.js';
import { Wily } from './wily.js';
import { Emerl } from './emerl.js';
import { MegaManZero } from './megaman-zero.js';
import { CpuFighter } from './cpu.js?v=team3-1';

const CPU_ROSTER = ['eggman', 'metal-sonic', 'sonic', 'tails', 'chaos', 'silver', 'megaman-zero', 'knuckles', 'shadow', 'rock', 'bass', 'zero', 'protoman', 'x'];

export function chooseCPUOpponentIndex(playerIndex) {
    const playerId = game.characterSelection.chars[playerIndex];
    const choices = CPU_ROSTER.filter((id) => id !== playerId);
    const available = choices.length ? choices : CPU_ROSTER;
    const fighterId = available[Math.floor(Math.random() * available.length)];
    return game.characterSelection.chars.indexOf(fighterId);
}

export function chooseTrainingPair() {
    const pool = CPU_ROSTER.map((id) => game.characterSelection.chars.indexOf(id)).filter((i) => i >= 0);
    if (pool.length < 2) return [pool[0] ?? 0, pool[0] ?? 0];
    const first = Math.floor(Math.random() * pool.length);
    let second = Math.floor(Math.random() * (pool.length - 1));
    if (second >= first) second++;
    return [pool[first], pool[second]];
}

export function chooseTrainingTeams() {
    const pool = [...CPU_ROSTER];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return [pool.slice(0, 3), pool.slice(3, 6)];
}

export function createFighter(character, x, y, controls) {
    if (['cut', 'guts', 'heat'].includes(character)) return new StoryRobot(character, x, y, controls);
    const factories = {
        espio: () => new Espio(x, y, controls),
        bass: () => new Bass(x, y, controls),
        chaos: () => new Chaos(x, y, controls),
        tails: () => new Tails(x, y, controls),
        'metal-sonic': () => new MetalSonic(x, y, controls),
        sonic: () => new Sonic(x, y, controls),
        shadow: () => new Shadow(x, y, controls),
        knuckles: () => new Knuckles(x, y, controls),
        silver: () => new Silver(x, y, controls),
        x: () => new X(x, y, controls),
        zero: () => new Zero(x, y, controls),
        rock: () => new Rock(x, y, controls),
        protoman: () => new ProtoMan(x, y, controls),
        eggman: () => new Eggman(x, y, controls),
        wily: () => new Wily(x, y, controls),
        emerl: () => new Emerl(x, y, controls),
        'megaman-zero': () => new MegaManZero(x, y, controls)
    };
    return (factories[character] || factories.espio)();
}

export function applyBattleControllers() {
    const defaults = { p1: game.mode === 'ai', p2: !['local','practice','online'].includes(game.mode) };
    for (const side of ['p1', 'p2']) {
        const slot = side === 'p1' ? 'cpuAgentP1' : 'cpuAgentP2';
        const enabled = game.controlOverrides?.[side] ?? defaults[side];
        if (enabled && !game[slot]) {
            const key = game.mode === 'ai' ? 'sonic-vs-megaman-cpu-training-' + (side === 'p1' ? 'blue' : 'red') + '-v1'
                : side === 'p1' ? 'sonic-vs-megaman-cpu-player-one-v1' : undefined;
            game[slot] = new CpuFighter(game.isolateCpu?null:key);
        }
        if (!enabled) game[slot] = null;
    }
    game.cpuAgent = game.mode === 'ai' ? null : game.cpuAgentP2;
    window.__CPU_AGENT__ = game.cpuAgent;
    window.__CPU_AGENT_P1__ = game.cpuAgentP1;
    window.__CPU_AGENT_P2__ = game.cpuAgentP2;
}

export function startBattle(storyMatch) {
    if (!storyMatch) music.play(game.battleStage?.track ?? 'highway');
    if (game.mode === 'ai') {
        game.teamRosters = chooseTrainingTeams();
    }
    game.isolateCpu=Boolean(storyMatch?.isolateCpu);
    const teamMatch = game.mode === 'ai' || game.mode === 'team' || Boolean(storyMatch) || (game.mode==='online' && game.teamRosters?.every(roster=>roster.length===3));
    const rosters = storyMatch?.rosters ?? game.teamRosters;
    game.teamActiveIndex = { p1: 0, p2: 0 };
    game.tagRequests = { p1: false, p2: false };
    game.tagCooldowns = { p1: 0, p2: 0 };
    game.tagEffects = [];
    const p1Char = teamMatch ? rosters[0][0] : game.characterSelection.chars[game.characterSelection.p1Index];
    const p2Char = teamMatch ? rosters[1][0] : game.characterSelection.chars[game.characterSelection.p2Index];

    const p1Controls = {
        left: 'KeyA', right: 'KeyD', jump: 'KeyW', crouch: 'KeyS',
        attack: 'KeyJ', heavy: 'KeyI', kickLight: 'KeyM', kickHeavy: 'KeyK',
        spinKey: 'Space', tag: 'KeyL'
    };

    const p2Controls = {
        left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', crouch: 'ArrowDown',
        attack: 'Comma', heavy: 'Period', kickLight: 'Minus', kickHeavy: 'Equal',
        spinKey: 'Enter', tag: 'Slash'
    };

    const floor=setArenaGeometry(game.mode==='story'?null:game.battleStage);
    resetWind();
    resetTeamAssists();
    resetEggmanSupports();
    game.eggAssists = {};
    game.eggAssistReady = {};
    game.silverAssist = {};
    game.silverAssistReady = {};
    game.projectiles = [];
    game.bassBullets = [];
    game.trebles = [];
    game.trebleBullets = [];
    game.cameraX = 0;
    game.winner = null;
    game.winnerName = '';
    game.roundEndsAt = null;
    game.roundSeconds = game.mode === 'practice' ? null : game.tournamentSeconds ??
        (game.mode === 'story' ? DEFAULT_ROUND_SECONDS : normalizeRoundSeconds(game.selectedRoundSeconds));
    game.resultReason = null;
    if (teamMatch) {
        game.teamFighters = {
            p1: rosters[0].map((id) => createFighter(id, 260, floor, p1Controls)),
            p2: rosters[1].map((id) => createFighter(id, 920, floor, p2Controls))
        };
        if (storyMatch?.health) {
            const fighters = game.teamFighters.p1;
            fighters.forEach((fighter, index) => { fighter.health = storyMatch.health[index]; });
            const preferred = storyMatch.activeIndex ?? 0;
            game.teamActiveIndex.p1 = fighters[preferred].health > 0 ? preferred : Math.max(0, fighters.findIndex(fighter => fighter.health > 0));
        }
        game.p1 = game.teamFighters.p1[game.teamActiveIndex.p1];
        game.p2 = game.teamFighters.p2[0];
        game.characterSelection.p1Index = game.characterSelection.chars.indexOf(p1Char);
        game.characterSelection.p2Index = game.characterSelection.chars.indexOf(p2Char);
    } else {
        game.teamFighters = null;
        game.p1 = createFighter(p1Char, 260, floor, p1Controls);
        game.p2 = createFighter(p2Char, 1000, floor, p2Controls);
    }

    for (const fighter of [game.p1,game.p2]) {
        if (['sonic','shadow','silver'].includes(fighter.characterId)) fighter.maxPower=300;
    }
    if (teamMatch) for (const roster of Object.values(game.teamFighters)) {
        let power = 0;
        for (const member of roster) {
            if (member.characterId === 'emerl') continue;
            member.maxPower = 300;
            Object.defineProperty(member, 'power', {
                get: () => power,
                set: value => { power = Math.max(0, Math.min(300, value)); }
            });
        }
    }
    game.reserveRecoveryAt = combatNow();
    if (game.mode==='practice') for(const f of [game.p1,game.p2]) f.power=f.maxPower;
    game.p1.startMMZeroIntro?.();
    game.p2.startMMZeroIntro?.();
    game.cpuAgentP1 = null;
    game.cpuAgentP2 = null;
    applyBattleControllers();

    if (storyMatch?.infected && game.p2.characterId === 'metal-sonic') game.p2.infected = true;
    game.countdown = { phase: 'waiting', phaseStartedAt: combatNow() };

    game.gameState = GAME_STATE.BATTLE;
}

function usableTeamCharacters(side) {
    const roster = game.teamFighters?.[side];
    if (!roster) return [];
    return roster.map((fighter, index) => ({ fighter, index })).filter(({ fighter, index }) =>
        index !== game.teamActiveIndex[side] && fighter.health > 0
    );
}

export function switchTeamFighter(side, { knockout = false, slot = null } = {}) {
    if (!game.teamFighters || !['p1', 'p2'].includes(side)) return false;
    const now = combatNow();
    if (!knockout && now < (game.tagCooldowns?.[side] || 0)) return false;
    const outgoing = game[side];
    const rival = game[side === 'p1' ? 'p2' : 'p1'];
    if (!knockout && rival?.grabConnected && !rival.grabThrown && rival.grabTarget === outgoing) return false;
    const candidates = usableTeamCharacters(side);
    if (!outgoing || !candidates.length || (!knockout && (outgoing.health <= 0 || outgoing.tagLockedUntil > now))) return false;
    const currentIndex = game.teamActiveIndex[side];
    const rosterSize = game.teamFighters[side].length;
    const roster = game.teamFighters[side];
    const reserveIndices = roster.map((_, index) => index).filter(index => index !== currentIndex);
    const next = slot === null ? candidates.reduce((best, item) => {
        if (!best) return item;
        const distance = (item.index - currentIndex + rosterSize) % rosterSize;
        const bestDistance = (best.index - currentIndex + rosterSize) % rosterSize;
        return distance < bestDistance ? item : best;
    }, null) : candidates.find(candidate => candidate.index === reserveIndices[slot]);
    if (!next) return false;
    if (!knockout && (game.teamAssists?.[side] || game.silverAssist?.[side] || game.eggAssists?.[side])) return false;
    const opponent = game[side === 'p1' ? 'p2' : 'p1'];
    const oldX = outgoing.x;
    const away = oldX < opponent.x ? -1 : 1;
    const [left,right]=HIGHWAY_WALLS;
    const edgeX = away < 0 ? left.x : right.x - next.fighter.width;
    const targetX = Math.max(left.x, Math.min(right.x - next.fighter.width, oldX + away * 260));
    const incoming = next.fighter;
    outgoing.cancelWilyMoves?.();
    outgoing.cancelSonicMoves?.();
    outgoing.cancelChaosMoves?.();
    outgoing.cancelSilverMoves?.();
    outgoing.cancelMMZeroMoves?.();
    for (const key of Object.keys(outgoing.keys || {})) outgoing.keys[key] = false;
    incoming.x = targetX;
    incoming.feetY = outgoing.feetY;
    incoming.y = incoming.feetY - incoming.height;
    incoming.vx = 0; incoming.vy = 0; incoming.isGrounded = true;
    incoming.isVulnerable = false; incoming.vulnerableTimer = 0;
    incoming.isIntroActive = false; incoming.introDone = true; incoming.isDashing = false;
    incoming.wasInAirFromKnockback = false;
    incoming.hitstunUntil = 0;
    if (incoming instanceof Bass) incoming.setState('idle');
    for (const key of Object.keys(incoming.keys || {})) incoming.keys[key] = false;
    incoming.tagLockedUntil = now + 760;
    game[side] = incoming;
    [roster[currentIndex], roster[next.index]] = [incoming, outgoing];
    incoming.recoverableHealth = 0;
    incoming.facingDirection = opponent.x >= incoming.x ? 1 : -1;
    incoming.facingLeft = incoming.facingDirection < 0;
    game.tagCooldowns[side] = now + 6000;
    game.tagEffects.push({
        side,
        style: ['sonic', 'metal-sonic', 'knuckles', 'shadow', 'espio', 'silver', 'emerl', 'tails', 'chaos'].includes(incoming.characterId) ? 'spin' : 'beam',
        startedAt: combatNow(), duration: 760, oldX, edgeX, targetX,
        outgoing, enteringId: incoming.characterId, knockout
    });
    return true;
}

export function returnToCharacterSelect() {
    music.stop();
    game.characterSelection.p1Confirmed = false;
    game.characterSelection.p2Confirmed = false;
    if (game.mode === 'team') game.teamRosters = [[], []];
    game.countdown = null;
    game.winner = null;
    game.p1 = null;
    game.p2 = null;
    if (game.mode !== 'ai') {
        game.cpuAgentP1 = null;
        game.cpuAgentP2 = null;
    }
    game.projectiles = [];
    game.bassBullets = [];
    game.trebles = [];
    game.trebleBullets = [];
    game.gameState = GAME_STATE.SELECT;
}
