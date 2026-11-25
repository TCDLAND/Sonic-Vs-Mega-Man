export const RED_HEALTH_FRACTION = .30;
import { impactWind } from './wind-effects.js';
import { combatNow } from './combat-clock.js';
import { captureTournamentHit } from './tournament-damage.js';
// Sistema central de vida, defensa y debug de combate.
export const MAX_HEALTH = 150;
export const GUARD_BREAK_DAMAGE = 60;
export const GUARD_BREAK_RECOVERY_MS = 1500;
const GUARD_COMBO_WINDOW_MS = 2800;

// Rock conserva su tamaño actual: el frame idle mide unos 128 px visibles y
// representa la referencia de 132 cm de Mega Man. sourceVisiblePx son las
// alturas alfa medidas en los sprites actuales, sin márgenes transparentes.
// Bass y Proto se estiman en 138 cm para que superen a Rock sólo un poco.
const ROCK_REFERENCE_CM = 132;
const ROCK_REFERENCE_VISIBLE_PX = 128;
const CHARACTER_SIZE_PROFILES = Object.freeze({
  rock: { heightCm: 132, sourceVisiblePx: 128 },
  'metal-sonic': { heightCm: 132, sourceVisiblePx: 112 },
  sonic: { heightCm: 132, sourceVisiblePx: 102 },
  knuckles: { heightCm: 159, sourceVisiblePx: 112 },
  shadow: { heightCm: 137, sourceVisiblePx: 108 },
  espio: { heightCm: 145, sourceVisiblePx: 132 },
  silver: { heightCm: 150, sourceVisiblePx: 153 },
  x: { heightCm: 168, sourceVisiblePx: 153 },
  zero: { heightCm: 182, sourceVisiblePx: 150 },
  bass: { heightCm: 143, sourceVisiblePx: 129 },
  protoman: { heightCm: 143, sourceVisiblePx: 153 },
  emerl: { heightCm: 128, sourceVisiblePx: 153 },
  'megaman-zero': { heightCm: 182, sourceVisiblePx: 153 }
});

function applyCharacterSize(fighter, id) {
  const profile = CHARACTER_SIZE_PROFILES[id];
  const previousScale = fighter.characterScale || 1;
  const baseWidth = fighter.width / previousScale;
  const baseHeight = fighter.height / previousScale;
  const scale = profile
    ? (ROCK_REFERENCE_VISIBLE_PX * profile.heightCm / ROCK_REFERENCE_CM) / profile.sourceVisiblePx
    : 1;
  fighter.characterScale = scale;
  fighter.width = baseWidth * scale;
  fighter.height = baseHeight * scale;
  fighter.y = fighter.feetY - fighter.height;
}

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
  'metal-sonic': 1.20,
  protoman: 1.30
});

export const DEBUG_COMBAT = {
  enabled: false,
  lastP1: 'Sin daño',
  lastP2: 'Sin daño'
};

export function configureCombatant(fighter, id, name) {
  fighter.characterId = id;
  applyCharacterSize(fighter, id);
  fighter.characterName = fighter.characterName || name || id.toUpperCase();
  fighter.maxHealth = MAX_HEALTH;
  fighter.health = MAX_HEALTH;
  fighter.defenseMultiplier = DEFENSE_MULTIPLIERS[id] ?? 1;
  fighter.guardDamage = 0;
  fighter.guardLastHitAt = 0;
  fighter.guardBrokenUntil = 0;
  fighter.guardBreakFlashUntil = 0;
}

export function resetGuardContact(fighter) {
  if (fighter) {
    fighter.guardDamage = 0;
    fighter.guardLastHitAt = 0;
  }
}

function incomingSideIsGuarded(receiver, attacker, impactX) {
  if (receiver.smokeTurnUntil > combatNow() && receiver.smokeTurnSource === attacker) return true;
  const sourceX = Number.isFinite(impactX)
    ? impactX
    : Number.isFinite(attacker?.x)
      ? attacker.x + (attacker.width || 0) / 2
      : null;
  if (sourceX === null) return true;
  const centerX = receiver.x + (receiver.width || 0) / 2;
  // Todas las clases exponen la orientación real usada para dibujar su sprite.
  const facing = receiver.characterId === 'bass'
    ? (receiver.facingLeft ? -1 : 1)
    : (receiver.facingDirection || 1);
  return (sourceX - centerX) * facing >= -Math.max(4, (receiver.width || 48) * 0.10);
}

export function dealDamage(receiver, baseDamage, options = {}) {
  const { attacker = null, attackName = 'Ataque', multiplier = 1, ignoreDefense = false } = options;
  if (receiver.characterId === 'chaos' && options.element === 'fire') {
    receiver.lastGuardImpact = { blocked: false, broken: false, front: false, at: combatNow() };
    return 0;
  }
  const interception = baseDamage > 0 && receiver.interceptIncomingHit?.(baseDamage, options);
  if (interception) {
    receiver.lastGuardImpact = { blocked: true, broken: false, front: true, shield: interception==='shield', at: combatNow() };
    return 0;
  }
  const impactY=options.impactY ?? (options.hitRect ? options.hitRect.y+options.hitRect.h/2 : undefined);
  if(receiver.leafShield?.active && !options.bypassLeaf && receiver.leafShield.intercept({x:options.impactX,y:impactY,attacker})){
    const now=combatNow();
    receiver.lastGuardImpact={blocked:true,broken:false,front:true,at:now};
    receiver.guardFlashUntil=now+180;
    receiver.leafBlockUntil=now+530;
    if(DEBUG_COMBAT.enabled)console.log('[LEAF SHIELD] Hoja interceptó el impacto:',attackName);return 0;
  }
  const weakBasicShot = options.basicShot && baseDamage < 6;
  const lightPellet = weakBasicShot && attacker?.characterId !== 'bass' && attackName !== 'Bass Buster';
  const shieldDamage = receiver.absorbCopyShield?.(baseDamage, options) ?? baseDamage;
  if (baseDamage > 0 && shieldDamage === 0) {
    receiver.lastGuardImpact = { blocked: true, broken: false, front: true, at: combatNow() };
    return 0;
  }
  baseDamage = shieldDamage;
  const defense = ignoreDefense ? 1 : (receiver.defenseMultiplier ?? 1);
  const raw = Math.max(0, baseDamage * multiplier * defense);
  let finalDamage = Math.round(raw * 100) / 100;
  const now = combatNow();
  const shieldGuard = receiver.shieldRaised;
  if (options.projectile && receiver.blocksProjectile?.()) {
    receiver.lastGuardImpact = { blocked: true, broken: false, front: true, at: now };
    return 0;
  }
  const requestedGuard = ((receiver.isGuarding && receiver.guardType) || shieldGuard) && !options.ignoreGuard;
  const guarded = Boolean(requestedGuard && incomingSideIsGuarded(receiver, attacker, options.impactX));
  const protoShield = shieldGuard && receiver.shieldMeleeCapacity;
  if (guarded && protoShield && options.projectile) {
    receiver.lastGuardImpact = { blocked:true, broken:false, front:true, shield:true, at:now };
    receiver.guardFlashUntil = now + 180;
    receiver.addPower?.(Math.min(2,raw*.13));
    receiver.onShieldProjectileBlock?.(baseDamage,now);
    if (baseDamage >= 16) impactWind(receiver,raw,{...options,wind:'stormFx'},true);
    return 0;
  }
  let guardBroken = false;
  receiver.lastGuardImpact = { blocked: false, broken: false, at: now };
  if (guarded) {
    const pressureKey = protoShield ? 'shieldMeleePressure' : 'guardDamage';
    const timeKey = protoShield ? 'shieldMeleeHitAt' : 'guardLastHitAt';
    const capacity = protoShield || GUARD_BREAK_DAMAGE;
    if (now - (receiver[timeKey] || 0) > GUARD_COMBO_WINDOW_MS) receiver[pressureKey] = 0;
    receiver[timeKey] = now;
    const pressure = (receiver[pressureKey] || 0) + raw;
    receiver[pressureKey] = weakBasicShot ? Math.min(pressure, capacity - 1) : pressure;
    if (receiver[pressureKey] >= capacity) {
      guardBroken = true;
      receiver[pressureKey] = 0;
      receiver.guardBrokenUntil = now + GUARD_BREAK_RECOVERY_MS;
      receiver.guardBreakFlashUntil = now + 560;
      receiver.guardImpactPending = false;
      receiver.guardFlashUntil = 0;
      receiver.isGuarding = false;
      receiver.guardType = null;
      receiver.isVulnerable = true;
      receiver.vulnerableTimer = Math.max(receiver.vulnerableTimer || 0, 30);
      const attackerCenter = Number.isFinite(attacker?.x) ? attacker.x + (attacker.width || 0) / 2 : null;
      const shove = attackerCenter === null
        ? (receiver.characterId === 'bass' ? (receiver.facingLeft ? 1 : -1) : -(receiver.facingDirection || 1))
        : attackerCenter <= receiver.x + receiver.width / 2 ? 1 : -1;
      receiver.vx = shove * 5;
      receiver.vy = -4;
      receiver.isGrounded = false;
      receiver.wasInAirFromKnockback = true;
      receiver.knockbackAirTimer = 0;
      receiver.lastGuardImpact = { blocked: false, broken: true, at: now };
    } else {
      receiver.guardImpactPending = !shieldGuard;
      receiver.guardFlashUntil = now + 180;
      receiver.lastGuardImpact = { blocked: true, broken: false, at: now };
      receiver.addPower?.(Math.min(protoShield ? 2 : 6, raw * (protoShield ? .13 : .4)));
      if (!options.guardHandled) finalDamage = Math.round(finalDamage * (shieldGuard ? 0 : options.guardMultiplier ?? 0.15) * 100) / 100;
    }
  }
  receiver.lastGuardImpact.front = Boolean(guarded || (requestedGuard && incomingSideIsGuarded(receiver, attacker, options.impactX)));
  // Chaos Control: los golpes se acumulan, nunca matan ni mueven al congelado.
  const stopper=receiver.shadowFrozenBy;
  if(stopper?.chaosPhase==='freeze'){
    finalDamage=Math.max(0,Math.min(finalDamage,35-stopper.chaosDamage,receiver.health-1));
    stopper.chaosDamage+=finalDamage;
  }
  if (finalDamage > 0 && !options.projectile && !options.attackName?.includes('Escudazo') &&
      !['protoBash', 'protoMelee'].includes(options.attackName) && typeof attacker?.x === 'number' &&
      Math.abs(attacker.x + attacker.width / 2 - receiver.x - receiver.width / 2) < 190) {
    receiver.onMeleeContact?.(attacker);
  }
  if (finalDamage > 0 && !lightPellet && receiver.busterCharging && receiver.characterId !== 'protoman' &&
      (receiver.characterId !== 'rock' || !receiver.lastGuardImpact?.blocked)) { receiver.busterCharging = false; receiver.busterChargeStart = 0; }
  const healthBeforeHit = receiver.health;
  receiver.health = Math.max(0, Math.round((receiver.health - finalDamage) * 100) / 100);
  captureTournamentHit(receiver, options, healthBeforeHit);
  // Breve hitstun impide que una entrada de movimiento borre la reacción al golpe.
  // Los impactos fuertes mantienen al rival detenido un poco más; el empuje lo
  // define cada ataque (Bass acumula el retroceso de sus ráfagas por separado).
  if (finalDamage > 0 && !lightPellet && !guarded && !guardBroken) {
    const hitstunMs = raw >= 14 ? 190 : raw >= 7 ? 145 : 110;
    receiver.hitstunUntil = Math.max(receiver.hitstunUntil || 0, now + hitstunMs);
  }
  if(finalDamage>0 && typeof receiver.onDamageTaken==='function') {
    receiver.onDamageTaken({attacker,attackName,damage:finalDamage,stagger:!lightPellet||guardBroken});
  }
  impactWind(receiver,guarded?raw:finalDamage,options,guarded);
  if (finalDamage > 0) {
    // Los tiros básicos mantienen su daño, pero casi no alimentan el medidor.
    // Para el resto premiamos el combate activo, y damos una fracción al rival.
    const basicShot = Boolean(options.basicShot);
    const healthLost = healthBeforeHit - receiver.health;
    const powerGain = healthLost * (basicShot ? 0.025 : 1.05);
    attacker?.addPower?.(powerGain);
    receiver?.addPower?.(healthLost * (basicShot ? 0.04 : 0.45));
    if (!receiver.lastGuardImpact?.blocked) receiver.meterCombo = null;
    if (attacker && !basicShot && healthLost > 0 && !receiver.lastGuardImpact?.blocked) {
      const combo = attacker.meterCombo;
      if (!combo || combo.target !== receiver || now - combo.lastAt > 750) {
        attacker.meterCombo = { target: receiver, lastAt: now, attacks: new Set([attackName]), power: powerGain };
      } else {
        combo.lastAt = now;
        combo.attacks.add(attackName);
        combo.power += powerGain;
        if (combo.attacks.size >= 3 && !combo.rewarded) {
          attacker.addPower?.(Math.max(0, 50 - combo.power));
          combo.rewarded = true;
        }
      }
    } else if (attacker) {
      attacker.meterCombo = null;
    }
  }

  if (finalDamage > 0) {
    const p1 = window.__GAME_P1__;
    const p2 = window.__GAME_P2__;
    const agentP1 = window.__CPU_AGENT_P1__;
  const agentP2 = window.__CPU_AGENT_P2__ || window.__CPU_AGENT__;
    const attackerAgent = attacker === p1 ? agentP1 : attacker === p2 ? agentP2 : null;
    const receiverAgent = receiver === p1 ? agentP1 : receiver === p2 ? agentP2 : null;
    if (attackerAgent) {
      if (receiver.lastGuardImpact?.blocked) attackerAgent.onBlocked?.();
      else if (finalDamage > 0) attackerAgent.onHit?.(finalDamage);
    }
  }
  if (guarded && receiver.lastGuardImpact?.blocked) {
    const p1 = window.__GAME_P1__, p2 = window.__GAME_P2__;
    const receiverAgent = receiver === p1 ? window.__CPU_AGENT_P1__ : receiver === p2 ? (window.__CPU_AGENT_P2__ || window.__CPU_AGENT__) : null;
    receiverAgent?.onGuard?.();
    receiver.onBlockedHit?.();
  }

  receiver.recoverableHealth = receiver.health > 0
    ? Math.max(0, Math.min(receiver.maxHealth - receiver.health,
        (receiver.recoverableHealth || 0) + Math.max(0, healthBeforeHit - receiver.health) * RED_HEALTH_FRACTION))
    : 0;
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
