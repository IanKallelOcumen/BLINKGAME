/**
 * Audio management - walk, breathing, jumpscare, stare sounds
 */
import { ASSETS, SETTINGS } from './config.js';
import { state } from './state.js';

export function initAudio() {
    state.walkAudio = new Audio(ASSETS.walkSound);
    state.walkAudio.loop = true;
    state.walkAudio.volume = SETTINGS.walkVolume;

    state.breathingAudio = new Audio(ASSETS.breathingSound);
    state.breathingAudio.loop = true;
    state.breathingAudio.volume = 0;

    state.jumpscareAudio = new Audio(ASSETS.jumpscareSound);
    state.jumpscareAudio.volume = 1;

    state.neckSnapAudio = new Audio(ASSETS.neckSnapSound || './neck-snap.mp3');
    state.neckSnapAudio.volume = 1;

    state.roomToneAudio = new Audio(ASSETS.roomToneSound || './room-tone.mp3');
    state.roomToneAudio.loop = true;
    state.roomToneAudio.volume = SETTINGS.roomToneVolume ?? 0.5;

    state.heartbeatAudio = new Audio(ASSETS.heartbeatSound || './heartbeat.mp3');
    state.heartbeatAudio.loop = true;
    state.heartbeatAudio.volume = 0;

    state.stareAudio = new Audio(ASSETS.stareSound || './stare-sound.mp3');
    state.stareAudio.volume = 0.9;
    state.stareAudio.addEventListener('loadedmetadata', () => {
        const d = state.stareAudio.duration;
        if (!isNaN(d) && d > 0) {
            state.stareSoundDuration = d;
            state.stareEffectStart = Math.max(0.3, d * 0.15);
        }
    });
}

export function startRoomTone() {
    if (!state.audioUnlocked || !state.roomToneAudio) return;
    state.roomToneAudio.volume = SETTINGS.roomToneVolume ?? 0.5;
    if (state.roomToneAudio.paused) {
        state.roomToneAudio.play().catch(() => {});
    }
}

export function unlockAudio() {
    if (state.audioUnlocked) return;
    state.audioUnlocked = true;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
    } catch (_) {}
    const playUnlock = (audio) => {
        if (!audio) return;
        audio.volume = audio === state.roomToneAudio ? (SETTINGS.roomToneVolume ?? 0.5) : audio.volume;
        const p = audio.play();
        if (p && p.catch) p.catch(() => {});
    };
    playUnlock(state.walkAudio);
    state.walkAudio?.pause();
    playUnlock(state.roomToneAudio);
}

export function updateSounds(isObservingEnemy, distToEnemy) {
    if (!state.audioUnlocked || state.isGameOver) return;

    const isMoving = state.moveForward || state.moveBackward || state.moveLeft || state.moveRight;

    if (state.walkAudio) {
        if (isMoving && state.controls?.isLocked) {
            if (state.walkAudio.paused) state.walkAudio.play().catch(() => {});
        } else {
            state.walkAudio.pause();
        }
    }

    let playBreathing = false;
    let breathingVol = 0.3;

    const heartbeatDist = SETTINGS.heartbeatDistance ?? 10;
    let playHeartbeat = false;
    let heartbeatVol = 0.5;
    if (state.enemyModel && distToEnemy !== undefined) {
        const closeAndLooking = distToEnemy < SETTINGS.breathingDistance && isObservingEnemy;
        if (closeAndLooking) {
            playBreathing = true;
            breathingVol = Math.min(1, Math.max(0.2, 1 - (distToEnemy / SETTINGS.breathingDistance) * 0.5));
        }
        if (distToEnemy < heartbeatDist) {
            playHeartbeat = true;
            heartbeatVol = Math.min(0.8, Math.max(0.3, 1 - distToEnemy / heartbeatDist * 0.5));
        }
    }
    if (state.heartbeatAudio) {
        if (playHeartbeat) {
            state.heartbeatAudio.volume = heartbeatVol;
            if (state.heartbeatAudio.paused) state.heartbeatAudio.play().catch(() => {});
        } else {
            state.heartbeatAudio.pause();
        }
    }
    if (!playBreathing && state.staminaLevel <= SETTINGS.staminaBreathingThreshold) {
        const recoveryFade = Math.min(1, state.stillTime / 2);
        if (recoveryFade < 1) {
            playBreathing = true;
            const lowVol = 0.35 + (1 - state.staminaLevel / SETTINGS.staminaBreathingThreshold) * 0.45;
            breathingVol = lowVol * (1 - recoveryFade * 0.7);
        }
    }

    if (state.breathingAudio) {
        if (playBreathing) {
            state.breathingAudio.volume = breathingVol;
            if (state.breathingAudio.paused) state.breathingAudio.play().catch(() => {});
        } else {
            state.breathingAudio.pause();
        }
    }
}

export function stopAllSounds() {
    state.walkAudio?.pause();
    state.breathingAudio?.pause();
    state.stareAudio?.pause();
    state.roomToneAudio?.pause();
    state.heartbeatAudio?.pause();
}

export function playStareSound() {
    if (!state.audioUnlocked) return;
    if (state.stareAudio && state.stareAudio.paused) {
        state.stareAudio.currentTime = 0;
        state.stareAudio.play().catch(() => {});
    }
}

export function stopStareSound() {
    state.stareAudio?.pause();
}

export function playJumpscare() {
    state.jumpscareAudio?.play().catch(() => {});
}

export function playNeckSnap() {
    if (state.neckSnapAudio) {
        state.neckSnapAudio.currentTime = 0;
        state.neckSnapAudio.play().catch(() => {});
    }
}

export function playArtifactPickup() {
    if (!state.audioUnlocked) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
    } catch (_) {}
}
