// ========================================
// SISTEMA UNIVERSAL DE SPIN DASH
// ========================================
// Separa deliberadamente:
// - carga (Nv.1/Nv.2/Nv.3)
// - velocidad/penetracion contra proyectiles
// - fuerza de choque Spin vs Spin
// - dano y lanzamiento al conectar
// Esto permite, por ejemplo, que Sonic atraviese mejor proyectiles,
// mientras Knuckles pega mucho mas fuerte si consigue llegar limpio.

export const SPIN_PROFILES = Object.freeze({
    sonic: Object.freeze({
        chargeIntervalMs: 90,
        speed: [0, 18, 24, 30],
        projectileForce: [0, 5, 8, 10],
        clashForce: [0, 4, 7, 9],
        damage: [0, 9, 15, 23],
        knockbackX: [0, 9, 13, 17],
        knockbackY: [0, -9, -13, -17]
    }),
    shadow: Object.freeze({
        chargeIntervalMs: 120,
        speed: [0, 17, 22, 27],
        projectileForce: [0, 5, 7, 9],
        clashForce: [0, 5, 8, 11],
        damage: [0, 12, 20, 30],
        knockbackX: [0, 10, 14, 19],
        knockbackY: [0, -10, -14, -19]
    }),
    espio: Object.freeze({
        chargeIntervalMs: 230,
        speed: [0, 15, 19, 23],
        projectileForce: [0, 4, 6, 8],
        clashForce: [0, 5, 8, 10],
        damage: [0, 10, 17, 26],
        knockbackX: [0, 10, 14, 18],
        knockbackY: [0, -10, -14, -18]
    }),
    silver: Object.freeze({
        // Silver no es especialista en Spin: ofrece menos, pero tampoco
        // se le castiga con una carga exageradamente lenta.
        chargeIntervalMs: 260,
        speed: [0, 12, 15, 18],
        projectileForce: [0, 3, 5, 6],
        clashForce: [0, 3, 5, 7],
        damage: [0, 8, 13, 19],
        knockbackX: [0, 7, 10, 13],
        knockbackY: [0, -7, -10, -13]
    }),
    knuckles: Object.freeze({
        chargeIntervalMs: 520,
        speed: [0, 11, 14, 17],
        projectileForce: [0, 3, 5, 7],
        clashForce: [0, 7, 11, 15],
        damage: [0, 13, 22, 34],
        knockbackX: [0, 12, 19, 28],
        knockbackY: [0, -11, -18, -25]
    })
});

export function getSpinProfile(name = 'espio') {
    return SPIN_PROFILES[name] || SPIN_PROFILES.espio;
}

export function getProjectileForce(projectile) {
    if (!projectile) return 1;
    if (Number.isFinite(projectile.projectileForce)) return projectile.projectileForce;
    if (projectile.type === 'shuriken') return 7; // Espio shuriken grande / Rock Full tier aprox.
    if (projectile.type === 'kunai') return 3;
    if (projectile.type === 'bassBullet') return 1;
    return 1;
}

// El proyectil NO resta fuerza acumulativa al Spin.
// Cada choque vuelve a comparar contra la fuerza base del Spin.
export function impactMultiplierAfterProjectile(spinForce, projectileForce) {
    if (spinForce >= projectileForce * 2) return 1.0;
    if (spinForce >= projectileForce * 1.5) return 0.75;
    return 0.50;
}
