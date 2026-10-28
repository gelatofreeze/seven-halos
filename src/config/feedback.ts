/**
 * Presentation-only feedback tuning: camera shake (duration ms, intensity as a
 * fraction of the view) and particle counts. Kept restrained for small screens.
 */
export const FEEDBACK = {
  shake: {
    lightHit: [70, 0.0035],
    heavyHit: [110, 0.006],
    playerHit: [140, 0.008],
    block: [60, 0.0025],
    guardBreak: [160, 0.008],
    parry: [90, 0.004],
    postureBreak: [180, 0.009],
    riposte: [200, 0.011],
    hardLanding: [80, 0.004],
  },
  sparks: { lightHit: 9, heavyHit: 16, block: 7, guardBreak: 18, parry: 14, riposte: 22, evade: 5, enemyDeath: 24 },
} as const satisfies { shake: Record<string, readonly [number, number]>; sparks: Record<string, number> };
