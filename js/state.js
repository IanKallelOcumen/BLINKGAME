/**
 * Shared game state - mutable state accessed by all modules
 */
import * as THREE from 'three';

export const state = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,

    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    prevTime: performance.now(),
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),

    staminaLevel: 100,
    isSprinting: false,
    stillTime: 0,
    blinkLevel: 100,
    isBlinking: false,
    forcedBlinkCooldown: 0,
    isGameOver: false,
    lives: 3,
    artifactsCollected: 0,
    artifacts: [],
    enemyModel: null,
    pendingEnemyModel: null,
    enemyPath: [],
    enemyPathTime: 0,
    enemyStuckFrames: 0,
    enemyLastTeleportTime: 0,
    enemyLastKnownPlayerPos: null,
    enemyLastKnownTime: 0,
    enemyBurstTime: 0,
    enemyWasObserved: false,
    enemyInCatchRangeTime: 0,
    lookingAtMonsterTime: 0,
    walls: [],
    mazePassagePositions: [],
    exitDoor: null,

    hasStarted: false,
    jumpscarePhase: 'none',
    jumpscareStartTime: 0,
    deathCameraPitch: 0,

    enemyFloorY: 1.0, // Y position for monster to stand on floor (feet at y=0)

    walkAudio: null,
    breathingAudio: null,
    jumpscareAudio: null,
    stareAudio: null,
    stareSoundDuration: null,
    stareEffectStart: null,
    audioUnlocked: false,
    masterVolume: 1.0,
    flashlight: null,
    flashlightIntensity: 35,
    flashlightDim: 0,
    flashlightOn: true,
    lastCameraY: 1.6,
    gameStartTime: 0,
    gameTimeLimit: 300,
    artifactAutoSpawnTime: null,
};
