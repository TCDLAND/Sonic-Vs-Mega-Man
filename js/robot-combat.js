import { hitTeamAssist } from './team-assists.js';
import { combatNow } from './combat-clock.js';
import { dealDamage } from './combat-system.js';
import { HIGHWAY_WALLS } from './wall-system.js';

export const BASS_MOVES = {
    punch: { key: 'bassPunch', ms: 62, frames: 4, active: [2, 2], damage: 9, range: 67, top: 105 },
    airPunch: { key: 'bassAirPunch', ms: 62, frames: 4, active: [2, 2], damage: 9, range: 72, top: 105 },
    kick: { key: 'bassKick', ms: 74, frames: 9, active: [3, 5], damage: 14, range: 86, top: 147, launch: -9, lift: -8, speed: 2.8, lowGuardOnly: true },
    dodge: { key: 'bassDodge', ms: 55, frames: 6, speed: -8 }
};

export const PROTO_MOVES = {
    punch: { key: 'protoMelee', ms: 65, frames: 4, active: [1, 2], damage: 10, range: 65, top: 98 },
    bash: { key: 'protoBash', ms: 71, frames: 6, active: [2, 4], damage: 14, range: 100, top: 115, speed: 4 },
    dodge: { key: 'protoDodge', ms: 57, frames: 6, speed: -7 }
};

export function beginRobotMove(fighter, spec, direction) {
    if (!spec) return false;
    fighter.robotMove = { spec, direction, started: combatNow(), hit: false, lifted: false };
    return true;
}

export function updateRobotMove(fighter, applyX = false) {
    const move = fighter.robotMove;
    if (!move) return;
    const frame = Math.floor((combatNow() - move.started) / move.spec.ms);
    if (frame >= move.spec.frames) {
        fighter.robotMove = null;
        return;
    }
    if (move.spec.lift && frame >= 2 && !move.lifted && fighter.isGrounded) {
        move.lifted = true;
        fighter.isGrounded = false;
        fighter.vy = move.spec.lift;
    }
    const [travelStart,travelEnd] = move.spec.travel ?? [1,3];
    const vx = frame >= travelStart && frame <= travelEnd ? (move.spec.speed || 0) * move.direction : 0;
    fighter.vx = vx;
    if (applyX) {
        const [left, right] = HIGHWAY_WALLS;
        fighter.x = Math.max(left.x, Math.min(right.x - fighter.width, fighter.x + vx));
    }
}

export function hitRobotMove(fighter, receiver, move = fighter.robotMove) {
    if (!move?.spec.active || move.hit || fighter.isHitstunned() ||
        receiver.minerPhase === 'under' || receiver.minerPhase === 'warning') return;
    const { spec, direction } = move;
    const frame = Math.floor((combatNow() - move.started) / spec.ms);
    if (frame < spec.active[0] || frame > spec.active[1]) return;
    const x = fighter.x + fighter.width / 2, feet = fighter.y + fighter.height;
    const rect = { x: spec.radial || direction < 0 ? x - spec.range : x, y: feet - spec.top, w: spec.radial ? spec.range * 2 : spec.range, h: spec.band ?? spec.top - 12 };
    if (hitTeamAssist(receiver,fighter,rect,spec.damage) || receiver.handleMeleeVsEddie?.(rect,fighter)) { move.hit=true; return; }
    const hit = receiver.shieldIntersects?.(rect) || (receiver.pixelBodyIntersectsRect
        ? receiver.pixelBodyIntersectsRect(rect, x)
        : rect.x < receiver.x + receiver.width && rect.x + rect.w > receiver.x &&
            rect.y < receiver.getCurrentY() + receiver.getCurrentHeight() && rect.y + rect.h > receiver.getCurrentY());
    if (!hit) return;
    move.hit = true;
    const damage = dealDamage(receiver, spec.damage, { attacker: fighter, attackName: spec.key, element: spec.ability === 'sword' ? 'fire' : undefined, impactX: x, hitRect: rect, wind:spec.wind, ignoreGuard: spec.lowGuardOnly && receiver.guardType !== 'low' });
    if (damage <= 0 || receiver.lastGuardImpact?.blocked || receiver.lastGuardImpact?.broken) return;
    receiver.vx = direction * 6;
    if (spec.launch) {
        receiver.vy = spec.launch;
        receiver.isGrounded = false;
        receiver.wasInAirFromKnockback = true;
        receiver.knockbackAirTimer = 0;
    }
}
