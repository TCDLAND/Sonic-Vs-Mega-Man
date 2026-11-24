let round = null;

export function beginTournamentDamage(rosters) {
    const fighters = new Map();
    const sides = { p1: { attacks: [], toolUses: {} }, p2: { attacks: [], toolUses: {} } };
    for (const [side, roster] of Object.entries(rosters)) {
        for (const fighter of roster) fighters.set(fighter, side);
    }
    round = { fighters, sides, attacks: new Map(), knockouts: new Map() };
}

export function captureTournamentHit(receiver, options, before) {
    if (!round || before <= receiver.health) return;
    const { attacker, attackName = 'Ataque', projectile, basicShot, damageCategory } = options;
    const side = round.fighters.get(attacker);
    const targetSide = round.fighters.get(receiver);
    if (!side || !targetSide || side === targetSide) return;

    const category = damageCategory ?? (projectile || basicShot ? 'proyectiles' : 'otros');
    const fighter = attacker.characterId;
    const key = JSON.stringify([side, fighter, category, attackName]);
    let hit = round.attacks.get(key);
    if (!hit) {
        hit = { fighter, attack: attackName, category, damage: 0, hits: 0 };
        round.attacks.set(key, hit);
        round.sides[side].attacks.push(hit);
    }
    hit.damage = Math.round(hit.damage * 100 + Math.round((before - receiver.health) * 100)) / 100;
    hit.hits++;
    if (receiver.health === 0) {
        round.knockouts.set(receiver, { fighter, attack: attackName, category, target: receiver.characterId });
    }
}

export function captureTournamentTool(fighter, tool, used = true) {
    const side = used && round?.fighters.get(fighter);
    if (side) {
        const counts = round.sides[side].toolUses;
        counts[tool] = (counts[tool] ?? 0) + 1;
    }
    return used;
}

export function endTournamentDamage(winner, reason, defeated) {
    const data = round;
    round = null;
    if (!data) return null;
    return {
        ...data.sides,
        finishingHit: winner !== 'draw' && reason === 'ko' ? data.knockouts.get(defeated) ?? null : null
    };
}

export function addWinDamage(row, attacks, finishingHit) {
    row.trackedWins++;
    if (finishingHit) row.finishingAttacks[finishingHit.attack] = (row.finishingAttacks[finishingHit.attack] ?? 0) + 1;
    const totals = {};
    for (const { category, damage, attack, hits } of attacks) {
        totals[category] = Math.round((totals[category] ?? 0) * 100 + Math.round(damage * 100)) / 100;
        const move = row.attacks[attack] ??= { category, damage: 0, hits: 0 };
        move.damage = Math.round(move.damage * 100 + Math.round(damage * 100)) / 100;
        move.hits += hits;
    }
    const ranking = Object.entries(totals).sort((a,b) => b[1] - a[1]);
    if (!ranking.length || ranking[0][1] === ranking[1]?.[1]) {
        row.winsWithoutLeadingCategory++;
        return;
    }
    const [category] = ranking[0];
    row.winsLedBy[category] = (row.winsLedBy[category] ?? 0) + 1;
}
