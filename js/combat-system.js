// Sistema central de vida, defensa y debug de combate.
export const MAX_HEALTH = 150;

export const DEFENSE_MULTIPLIERS = Object.freeze({
  knuckles: 0.80,
  x: 0.88,
  shadow: 0.88,
  zero: 0.93,
  eggman: 0.93,
  wily: 0.93,
  'megaman-zero': 0.93,
  bass: 1.00,
  emerl: 1.00,
  silver: 1.00,
  espio: 1.06,
  rock: 1.12,
  sonic: 1.20,
  protoman: 1.30
});

export const DEBUG_COMBAT = {
  enabled: true,
  lastP1: 'Sin daño',
  lastP2: 'Sin daño'
};

export function configureCombatant(fighter, id, name) {
  fighter.characterId = id;
  fighter.characterName = fighter.characterName || name || id.toUpperCase();
  fighter.maxHealth = MAX_HEALTH;
  fighter.health = MAX_HEALTH;
  fighter.defenseMultiplier = DEFENSE_MULTIPLIERS[id] ?? 1;
}

export function dealDamage(receiver, baseDamage, options = {}) {
  const { attacker = null, attackName = 'Ataque', multiplier = 1, ignoreDefense = false } = options;
  if(receiver.leafShield?.active && !options.bypassLeaf && receiver.leafShield.intercept({x:options.impactX,y:options.impactY,attacker})){
    if(DEBUG_COMBAT.enabled)console.log('[LEAF SHIELD] Hoja interceptó el impacto:',attackName);return 0;
  }
  const defense = ignoreDefense ? 1 : (receiver.defenseMultiplier ?? 1);
  const raw = Math.max(0, baseDamage * multiplier * defense);
  let finalDamage = Math.round(raw * 100) / 100;
  // Chaos Control: los golpes se acumulan, nunca matan ni mueven al congelado.
  const stopper=receiver.shadowFrozenBy;
  if(stopper?.chaosPhase==='freeze'){
    finalDamage=Math.max(0,Math.min(finalDamage,35-stopper.chaosDamage,receiver.health-1));
    stopper.chaosDamage+=finalDamage;
  }
  if (finalDamage > 0 && receiver.busterCharging && receiver.characterId !== 'protoman') { receiver.busterCharging = false; receiver.busterChargeStart = 0; }
  receiver.health = Math.max(0, Math.round((receiver.health - finalDamage) * 100) / 100);
  if(finalDamage>0 && typeof receiver.onDamageTaken==='function') receiver.onDamageTaken({attacker,attackName,damage:finalDamage});

  const who = receiver === window.__GAME_P1__ ? 'P1' : receiver === window.__GAME_P2__ ? 'P2' : receiver.characterName || 'Fighter';
  const attackerName = attacker?.characterName || attacker?.characterId || 'Sistema';
  const msg = `${who} recibió ${finalDamage} | HP ${receiver.health}/${receiver.maxHealth ?? MAX_HEALTH}`;
  if (receiver === window.__GAME_P1__) DEBUG_COMBAT.lastP1 = msg;
  if (receiver === window.__GAME_P2__) DEBUG_COMBAT.lastP2 = msg;

  if (DEBUG_COMBAT.enabled) {
    console.log(`[DAMAGE] ${attackerName} -> ${receiver.characterName || receiver.characterId || who} | ${attackName} | Base: ${baseDamage} | Defensa: ${Math.round(defense * 100)}% | Final: ${finalDamage} | HP: ${receiver.health}/${receiver.maxHealth ?? MAX_HEALTH}`);
  }
  return finalDamage;
}
