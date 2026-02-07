/**
 * Game configuration - assets and settings
 */
// Paths relative to index.html location
export const ASSETS = {
    enemy: './monster.glb',
    enemyTexture: './monster-texture.png',
    artifact: './artifact.glb',
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
    staminaDrain: 22,
    staminaRegen: 28,
    staminaRegenWalking: 10,
    blinkDuration: 140,
    blinkDrainMoving: 20,
    blinkDrainStill: 4,
    enemySpeed: 2.6,
    enemySpeedPerArtifact: 0.4,
    enemyBurstMultiplier: 1.4,
    enemyBurstDuration: 0.4,
    enemyBurstDurationPerArtifact: 0.12,
    catchDistance: 1.3,
    instantKillFromBehindDistance: 0.5,
    catchGracePeriod: 0.5,
    staminaBreathingThreshold: 25,
    stareKillTime: 5.0,
    stareEffectStart: 0.5,
    stareWarningThreshold: 0.5,
    stareKillDistance: 13,
    observationDotThreshold: 0.55,
    minEnemyDistance: 3.0,
    wallCollisionProximity: 15.0,
    minimapEnemyProximity: 20.0,
    totalArtifacts: 5,
    artifactBlinkRefill: 18,
    breathingDistance: 12.0,
    heartbeatDistance: 10.0,
    heartbeatCloseThreshold: 1.8,
    heartbeatPlaybackRateClose: 2.0,
    teleportScareMin: 6,
    teleportScareMax: 14,
    teleportCooldown: 25,
    teleportCooldownPerArtifact: -2,
    enemyMemoryDecayTime: 5,
    enemyMemoryDecayPerArtifact: -0.45,
    walkVolume: 0.35,
    roomToneVolume: 0.5,
    flashlightDrainRate: 0.00025,
    flashlightRecoverRate: 0.00055,
};

export const PLAYER_RADIUS = 0.6;
export const EXIT_RADIUS = 2.0;
export const DEATH_DURATION = 1200;
