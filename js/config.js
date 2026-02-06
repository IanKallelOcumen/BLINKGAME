/**
 * Game configuration - assets and settings
 */
// Paths relative to index.html location
export const ASSETS = {
    enemy: './monster.glb',
    enemyTexture: './monster-texture.png',
    floorTexture: './floor-texture.png',
    wallTexture: './wall-texture.png',
    walkSound: './Walk On Concrete - Sound Effect for editing.mp3',
    breathingSound: './heavy breathing sound effect.mp3',
    jumpscareSound: './Jumpscare Sound Effect.mp3',
    stareSound: './stare-sound.mp3',
    neckSnapSound: './neck-snap.mp3',
    roomToneSound: './room-tone.mp3',
    heartbeatSound: './heartbeat.mp3',
};

export const SETTINGS = {
    walkSpeed: 40,
    sprintSpeed: 65,
    staminaDrain: 16,
    staminaRegen: 35,
    blinkDuration: 140,
    blinkDrainMoving: 15,
    blinkDrainStill: 4,
    enemySpeed: 3.1,
    enemySpeedPerArtifact: 0.3,
    enemyBurstMultiplier: 1.4,
    enemyBurstDuration: 0.4,
    catchDistance: 1.1,
    instantKillFromBehindDistance: 0.5,
    catchGracePeriod: 0.7,
    staminaBreathingThreshold: 25,
    stareKillTime: 6.5,
    stareEffectStart: 0.5,
    stareKillDistance: 13,
    observationDotThreshold: 0.82,
    minEnemyDistance: 3.0,
    wallCollisionProximity: 15.0,
    minimapEnemyProximity: 20.0,
    totalArtifacts: 5,
    breathingDistance: 12.0,
    heartbeatDistance: 10.0,
    teleportScareMin: 6,
    teleportScareMax: 14,
    teleportCooldown: 25,
    walkVolume: 0.35,
    roomToneVolume: 0.5,
};

export const PLAYER_RADIUS = 0.6;
export const EXIT_RADIUS = 2.0;
export const DEATH_DURATION = 1200;
