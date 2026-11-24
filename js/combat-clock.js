let pausedAt = null;
let pausedDuration = 0;
let simulatedAt=null;

export function setSimulatedCombatTime(value) { simulatedAt=value; }

export function combatNow() {
    if(simulatedAt!==null)return simulatedAt;
    return (pausedAt ?? performance.now()) - pausedDuration;
}

export function setCombatPaused(paused) {
    if (paused && pausedAt === null) pausedAt = performance.now();
    if (!paused && pausedAt !== null) {
        pausedDuration += performance.now() - pausedAt;
        pausedAt = null;
    }
}
