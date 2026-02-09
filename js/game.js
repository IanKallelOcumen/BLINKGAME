/**
 * Main game - init, input, game loop
 */
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import {
    ASSETS,
    SETTINGS,
    PLAYER_RADIUS,
    EXIT_RADIUS,
    DEATH_DURATION,
} from './config.js';
import { state } from './state.js';
import { initAudio, unlockAudio, startRoomTone, updateSounds, stopAllSounds, stopStareSound, playStareSound, playJumpscare, playNeckSnap, playArtifactPickup, playExitUnlocked } from './audio.js';
import { generateLevel } from './level.js';
import { loadGameAssets, moveEnemyStep, enemyIsObserved, spawnEnemy } from './enemy.js';
import { updateMinimap } from './minimap.js';

const _dom = {};
function dom(id) {
    if (_dom[id] === undefined) {
        const el = document.getElementById(id);
        if (el) _dom[id] = el;
    }
    return _dom[id];
}

function startGame() {
    if (state.hasStarted) return;
    state.hasStarted = true;
    unlockAudio();
    const startScreen = dom('start-screen');
    if (startScreen) {
        startScreen.classList.add('hidden');
        startScreen.style.display = 'none';
    }
    setTimeout(() => {
        dom('controls-hint-overlay')?.classList.add('hidden');
    }, 5000);
    state.controls?.lock();
}

function hideLoading() {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/df00b495-a20e-4eae-9d8e-a4e922ffc4ab',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'game.js:hideLoading',message:'hideLoading called',data:{},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    dom('loading-overlay')?.classList.add('hidden');
}

function performBlink(refill) {
    if (state.isBlinking || state.isGameOver) return;
    if (refill && (state.manualBlinkCooldown || 0) > 0) return;
    state.isBlinking = true;
    state.enemyPath = null;
    if (state.enemyModel) state.enemyBurstTime = SETTINGS.enemyBurstDuration;
    const blackout = dom('blackout');
    if (blackout) blackout.style.opacity = '1';
    setTimeout(() => {
        if (blackout) blackout.style.opacity = '0';
        state.isBlinking = false;
        if (refill) {
            state.blinkLevel = 100;
            state.manualBlinkCooldown = 0.5;
        }
    }, SETTINGS.blinkDuration);
}

const WALL_HALF_SIZE = 2;
const WALL_THRESHOLD = WALL_HALF_SIZE + PLAYER_RADIUS + 0.08; // extra margin to prevent tunnel-through

function pointInsideWallBox(px, pz, wx, wz) {
    return Math.abs(px - wx) <= WALL_THRESHOLD && Math.abs(pz - wz) <= WALL_THRESHOLD;
}

function collidesWithWalls(pos) {
    if (!state.walls || state.walls.length === 0) return false;
    for (const w of state.walls) {
        if (pointInsideWallBox(pos.x, pos.z, w.position.x, w.position.z)) return true;
    }
    return false;
}

function segmentCollidesWithWalls(fromPos, toPos) {
    if (!state.walls || state.walls.length === 0) return false;
    const ax = fromPos.x, az = fromPos.z;
    const bx = toPos.x, bz = toPos.z;
    for (const w of state.walls) {
        const wx = w.position.x, wz = w.position.z;
        if (pointInsideWallBox(ax, az, wx, wz) || pointInsideWallBox(bx, bz, wx, wz)) return true;
        const minX = wx - WALL_THRESHOLD, maxX = wx + WALL_THRESHOLD;
        const minZ = wz - WALL_THRESHOLD, maxZ = wz + WALL_THRESHOLD;
        const dx = bx - ax, dz = bz - az;
        let t0 = 0, t1 = 1;
        if (Math.abs(dx) >= 1e-9) {
            const tx0 = (minX - ax) / dx, tx1 = (maxX - ax) / dx;
            t0 = Math.max(t0, Math.min(tx0, tx1));
            t1 = Math.min(t1, Math.max(tx0, tx1));
        } else if (ax < minX || ax > maxX) continue;
        if (t0 > t1) continue;
        if (Math.abs(dz) >= 1e-9) {
            const tz0 = (minZ - az) / dz, tz1 = (maxZ - az) / dz;
            t0 = Math.max(t0, Math.min(tz0, tz1));
            t1 = Math.min(t1, Math.max(tz0, tz1));
        } else if (az < minZ || az > maxZ) continue;
        if (t0 <= t1 && t1 >= 0 && t0 <= 1) return true;
    }
    return false;
}

function collidesWithEnemy(pos) {
    if (!state.enemyModel) return false;
    const dist = pos.distanceTo(state.enemyModel.position);
    return dist < SETTINGS.catchDistance + PLAYER_RADIUS * 0.5;
}

let _artifactFrame = 0;

function checkArtifacts() {
    if (!state.camera) return;
    const t = performance.now() * 0.001;
    _artifactFrame++;
    for (const art of state.artifacts) {
        art.rotation.y += 0.02;
        art.position.y = 1 + Math.sin(t * 1.2 + art.position.x) * 0.06;
        if (_artifactFrame % 4 === 0) {
            art.traverse((child) => {
                if (child.isPoints && child.geometry?.attributes?.position) {
                    const pos = child.geometry.attributes.position;
                    const base = child.userData.basePositions;
                    if (base) {
                        for (let i = 0; i < pos.count; i++) {
                            const phase = (i / pos.count) * Math.PI * 2 + t * 0.8;
                            pos.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(phase) * 0.12;
                        }
                        pos.needsUpdate = true;
                    }
                }
            });
        }
    }

    const playerPos = state.camera.position;
    const collectedThisFrame = [];
    state.artifacts = state.artifacts.filter((art) => {
        if (art.position.distanceTo(playerPos) < 2) {
            collectedThisFrame.push(art);
            state.scene.remove(art);
            state.artifactsCollected++;
            return false;
        }
        return true;
    });

    if (collectedThisFrame.length > 0) {
        playArtifactPickup();
        const counterEl = dom('item-count');
        if (counterEl) {
            counterEl.innerText = `Artifacts: ${state.artifactsCollected}/${SETTINGS.totalArtifacts}`;
        }
        if (
            state.artifactsCollected === 1 &&
            state.pendingEnemyModel &&
            !state.enemyModel
        ) {
            spawnEnemy();
            playJumpscare();
            const txt = dom('center-text');
            if (txt && !state.isGameOver) {
                txt.innerText = 'IT HAS AWAKENED';
                txt.style.display = 'block';
                txt.style.color = '#c41e3a';
                setTimeout(() => {
                    if (txt && !state.isGameOver) txt.style.display = 'none';
                }, 3000);
            }
        }
        const refill = SETTINGS.artifactBlinkRefill ?? 0;
        if (refill > 0) {
            state.blinkLevel = Math.min(100, state.blinkLevel + refill);
        }
        if (
            state.artifactsCollected === SETTINGS.totalArtifacts &&
            state.exitDoor &&
            !state.exitDoor.visible
        ) {
            state.exitDoor.visible = true;
            if (state.exitDoorGlow) state.exitDoorGlow.intensity = 3;
            if (state.exitDoorParticles) state.exitDoorParticles.visible = true;
            playExitUnlocked();
            const txt = dom('center-text');
            if (txt && !state.isGameOver) {
                txt.innerText = 'THE EXIT IS OPEN';
                txt.style.display = 'block';
                txt.style.color = '#ffffff';
                setTimeout(() => {
                    if (txt && !state.isGameOver) txt.style.display = 'none';
                }, 3000);
            }
        }
    }
}

function checkExitDoor() {
    if (!state.exitDoor || !state.exitDoor.visible || state.isGameOver || !state.camera) return;
    const dist = state.camera.position.distanceTo(state.exitDoor.position);
    if (dist < EXIT_RADIUS) gameWin();
}

function respawnPlayer() {
    const respawnPos = state.mazePassagePositions?.length > 0
        ? state.mazePassagePositions[Math.floor(Math.random() * state.mazePassagePositions.length)]
        : { x: 0, z: 0 };
    state.camera.position.set(respawnPos.x, 1.6, respawnPos.z);
    state.camera.rotation.set(0, 0, 0);
    state.deathCameraPitch = 0;
    state.velocity.set(0, 0, 0);
    state.staminaLevel = 100;
    state.blinkLevel = 100;
    state.flashlightOn = true;
    state.flashlightDim = 0;
    state.jumpscarePhase = 'none';
    state.lookingAtMonsterTime = 0;
    state.enemyInCatchRangeTime = 0;
    if (state.enemyModel) {
        state.enemyModel.position.set(
            respawnPos.x + 20,
            state.enemyFloorY,
            respawnPos.z + 20
        );
        state.enemyPath = null;
    }
    const meters = dom('meters-panel');
    if (meters) meters.style.display = '';
    const mm = dom('minimap');
    if (mm) mm.style.display = '';
    const ic = dom('item-count');
    if (ic) ic.style.display = '';
    const lc = dom('lives-count');
    if (lc) lc.style.display = '';
    const ch = dom('controls-hint');
    if (ch) ch.style.display = '';
    dom('controls-hint-overlay')?.classList.remove('hidden');
    const dol = dom('death-overlay');
    if (dol) dol.style.opacity = '0';
    state.controls?.lock();
}

function triggerCaught() {
    if (state.jumpscarePhase !== 'none') return;
    if (!state.camera) return;
    state.jumpscarePhase = 'jumpscare';
    state.jumpscareStartTime = performance.now();
    state.deathCameraPitch = state.camera.rotation.x;

    stopAllSounds();
    playNeckSnap();
    state.controls?.unlock();

    const meters = dom('meters-panel');
    if (meters) meters.style.display = 'none';
    const mm = dom('minimap');
    if (mm) mm.style.display = 'none';
    const ic = dom('item-count');
    if (ic) ic.style.display = 'none';
    const lc = dom('lives-count');
    if (lc) lc.style.display = 'none';
    const ch = dom('controls-hint');
    if (ch) ch.style.display = 'none';
    dom('controls-hint-overlay')?.classList.add('hidden');
    dom('stare-vignette')?.classList.remove('active');
    dom('stare-crazy')?.classList.remove('visible');
    dom('stare-crazy')?.classList.remove('shake');
    stopStareSound();
    const dol = dom('death-overlay');
    if (dol) dol.style.opacity = '0';
}

function showGameOverScreen() {
    state.jumpscarePhase = 'done';
    state.lives--;
    const lc = dom('lives-count');
    if (lc) lc.innerText = `Lives: ${state.lives}`;
    if (state.lives > 0) {
        setTimeout(() => {
            respawnPlayer();
        }, 2000);
    } else {
        state.isGameOver = true;
        const vp = dom('game-viewport');
        if (vp) {
            vp.style.transform = 'none';
            vp.style.opacity = '0.3';
            vp.style.transition = 'opacity 0.4s ease';
        }
        const dol = dom('death-overlay');
        if (dol) dol.style.opacity = '';
        const txt = dom('center-text');
        if (txt) { txt.innerText = 'GAME OVER'; txt.style.display = 'block'; }
        const rb = dom('restart-btn');
        if (rb) rb.style.display = 'block';
    }
}

function gameWin() {
    if (state.isGameOver) return;
    state.isGameOver = true;
    stopAllSounds();
    state.controls.unlock();
    const txt = dom('center-text');
    if (txt) { txt.innerText = 'ESCAPED'; txt.style.display = 'block'; txt.style.color = '#00ff00'; }
    const rb = dom('restart-btn');
    if (rb) rb.style.display = 'block';
}

function init() {
    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0x000000);
    state.scene.fog = new THREE.FogExp2(0x000000, 0.06);

    state.camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    state.camera.position.y = 1.6;

    const flashlight = new THREE.SpotLight(0xffffff, 35);
    flashlight.position.set(0, 0, 0);
    flashlight.angle = 0.6;
    flashlight.penumbra = 0.4;
    flashlight.decay = 1.5;
    flashlight.distance = 50;
    flashlight.target.position.set(0, 0, -1);
    state.camera.add(flashlight);
    state.camera.add(flashlight.target);
    state.flashlight = flashlight;
    state.flashlightIntensity = 35;
    state.scene.add(state.camera);

    const ambient = new THREE.AmbientLight(0xffffff, 0.12);
    state.scene.add(ambient);

    state.renderer = new THREE.WebGLRenderer({ antialias: false, precision: 'lowp' });
    state.renderer.setSize(window.innerWidth / 2, window.innerHeight / 2, false);
    state.renderer.domElement.style.width = '100%';
    state.renderer.domElement.style.height = '100%';
    state.renderer.domElement.style.imageRendering = 'pixelated';
    state.renderer.setPixelRatio(1);
    state.renderer.shadowMap.enabled = false;
    if (state.renderer.outputColorSpace !== undefined) {
        state.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
        state.renderer.outputEncoding = THREE.sRGBEncoding;
    }
    state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    state.renderer.toneMappingExposure = 1.0;
    const viewport = dom('game-viewport');
    if (viewport) viewport.appendChild(state.renderer.domElement);

    state.controls = new PointerLockControls(state.camera, document.body);

    dom('start-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        startGame();
    });

    dom('start-screen')?.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'start-btn') return;
        startGame();
    });

    document.addEventListener('wheel', (e) => {
        if (state.controls?.isLocked) {
            if (e.deltaY < 0) {
                state.masterVolume = Math.min(1, state.masterVolume + 0.05);
            } else if (e.deltaY > 0) {
                state.masterVolume = Math.max(0, state.masterVolume - 0.05);
            }
            updateVolumeDisplay();
        }
    }, { passive: true });

    const volumeBar = dom('volume-bar');
    if (volumeBar) {
        volumeBar.addEventListener('click', (e) => {
            const rect = volumeBar.getBoundingClientRect();
            const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            state.masterVolume = frac;
            updateVolumeDisplay();
        });
    }

    document.addEventListener('click', () => {
        if (dom('start-screen')?.classList.contains('hidden')) {
            state.controls?.lock();
            unlockAudio();
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (state.controls?.isLocked && state.hasStarted && !state.isGameOver && state.jumpscarePhase === 'none') {
            state.flashlightOn = !state.flashlightOn;
            e.preventDefault();
        }
    });

    // Re-lock pointer if it escapes during gameplay
    document.addEventListener('pointerlockchange', () => {
        if (state.hasStarted && !state.isGameOver && !state.controls?.isLocked && state.jumpscarePhase === 'none') {
            state.controls?.lock();
        }
    });

    initAudio();

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' && !state.hasStarted) {
            startGame();
            e.preventDefault();
            return;
        }
        // Prevent Escape from unlocking pointer during gameplay
        if (e.code === 'Escape' && state.hasStarted && !state.isGameOver) {
            e.preventDefault();
            return;
        }
        switch (e.code) {
            case 'KeyW':
                state.moveForward = true;
                e.preventDefault();
                break;
            case 'KeyA':
                state.moveLeft = true;
                e.preventDefault();
                break;
            case 'KeyS':
                state.moveBackward = true;
                e.preventDefault();
                break;
            case 'KeyD':
                state.moveRight = true;
                e.preventDefault();
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                state.isSprinting = true;
                e.preventDefault();
                break;
            case 'Space':
                performBlink(true);
                e.preventDefault();
                break;
            case 'Equal':
            case 'Plus':
                state.masterVolume = Math.min(1, state.masterVolume + 0.1);
                updateVolumeDisplay();
                e.preventDefault();
                break;
            case 'Minus':
                state.masterVolume = Math.max(0, state.masterVolume - 0.1);
                updateVolumeDisplay();
                e.preventDefault();
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'KeyW':
                state.moveForward = false;
                e.preventDefault();
                break;
            case 'KeyA':
                state.moveLeft = false;
                e.preventDefault();
                break;
            case 'KeyS':
                state.moveBackward = false;
                e.preventDefault();
                break;
            case 'KeyD':
                state.moveRight = false;
                e.preventDefault();
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                state.isSprinting = false;
                e.preventDefault();
                break;
        }
    });

    generateLevel();
    loadGameAssets(hideLoading);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && state.controls?.isLocked) {
            state.controls.unlock();
        }
    });

    state.controls.addEventListener('lock', () => {
        state.prevTime = performance.now();
        state.gameStartTime = performance.now();
        state.lastCameraY = state.camera.position.y;
        startRoomTone();
    });
    state.controls.addEventListener('unlock', () => { stopAllSounds(); });

    state.renderer.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
    });
}

const MAX_DELTA = 0.1;

function updateFlashlightAndTimer() {
    if (!state.gameStartTime || state.isGameOver || !state.camera) return;

    const elapsed = (performance.now() - state.gameStartTime) / 1000;
    const remaining = Math.max(0, state.gameTimeLimit - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    const timerEl = dom('game-timer');
    if (timerEl) {
        timerEl.innerText = `Time: ${mins}:${secs < 10 ? '0' : ''}${secs}`;
        timerEl.classList.toggle('low-time', remaining > 0 && remaining < 60);
    }

    if (remaining <= 0 && state.artifacts.length > 0) {
        state.artifacts.forEach((art) => {
            if (art && art.position) {
                art.position.y = 1.5;
                art.visible = true;
            }
        });
    }

    const shakeAmount = Math.abs(state.camera.position.y - state.lastCameraY);
    if (shakeAmount > 0.3) {
        state.flashlightDim = 0;
    }
    state.lastCameraY = state.camera.position.y;

    const drainRate = SETTINGS.flashlightDrainRate ?? 0.0005;
    const recoverRate = SETTINGS.flashlightRecoverRate ?? 0.0003;
    if (state.flashlightOn) {
        state.flashlightDim += drainRate;
    } else {
        state.flashlightDim = Math.max(0, state.flashlightDim - recoverRate);
    }
    state.flashlightDim = Math.min(1, state.flashlightDim);
    const intensity = state.flashlightOn
        ? Math.max(2, state.flashlightIntensity * (1 - Math.min(1, state.flashlightDim)))
        : 0;
    if (state.flashlight) state.flashlight.intensity = intensity;
}


let _volumeDisplayLoggedOnce = false;
function updateVolumeDisplay() {
    const masterVol = state.masterVolume ?? 1;
    // #region agent log
    if (!_volumeDisplayLoggedOnce) {
        _volumeDisplayLoggedOnce = true;
        fetch('http://127.0.0.1:7242/ingest/df00b495-a20e-4eae-9d8e-a4e922ffc4ab',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'game.js:updateVolumeDisplay',message:'volume display first run',data:{masterVol,isNumber:typeof masterVol==='number'},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    }
    // #endregion
    const fill = dom('volume-fill');
    if (fill) {
        fill.style.width = (masterVol * 100) + '%';
    }
    // Apply master volume so scroll/keys affect all sounds live (breathing/heartbeat updated in updateSounds)
    if (state.roomToneAudio) state.roomToneAudio.volume = (SETTINGS.roomToneVolume ?? 0.5) * masterVol;
    if (state.walkAudio) state.walkAudio.volume = (SETTINGS.walkVolume ?? 0.35) * masterVol;
    if (state.jumpscareAudio) state.jumpscareAudio.volume = 1.0 * masterVol;
    if (state.neckSnapAudio) state.neckSnapAudio.volume = 1.0 * masterVol;
    if (state.stareAudio) state.stareAudio.volume = 0.9 * masterVol;
}

function animate() {
    requestAnimationFrame(animate);

    if (state.jumpscarePhase === 'jumpscare') {
        const elapsed = performance.now() - state.jumpscareStartTime;
        const progress = Math.min(1, elapsed / DEATH_DURATION);
        state.camera.rotation.x = (state.deathCameraPitch || 0) + progress * Math.PI * 0.5;
        const overlay = dom('death-overlay');
        if (overlay) overlay.style.opacity = String(progress);

        try {
            state.renderer.render(state.scene, state.camera);
        } catch (e) {
            console.warn('Render skipped:', e);
        }

        if (elapsed >= DEATH_DURATION) {
            showGameOverScreen();
        }
        return;
    }

    if (state.controls?.isLocked && !state.isGameOver) {
        const time = performance.now();
        let delta = (time - state.prevTime) / 1000;
        if (delta > MAX_DELTA) delta = MAX_DELTA;

        state.velocity.x -= state.velocity.x * 10.0 * delta;
        state.velocity.z -= state.velocity.z * 10.0 * delta;
        state.direction.z = Number(state.moveForward) - Number(state.moveBackward);
        state.direction.x = Number(state.moveRight) - Number(state.moveLeft);
        state.direction.normalize();

        const isMoving = state.moveForward || state.moveBackward || state.moveLeft || state.moveRight;
        if (isMoving) {
            state.stillTime = 0;
        } else {
            state.stillTime += delta;
        }

        const canSprint = state.isSprinting && isMoving && state.staminaLevel > 0;
        const speed = canSprint ? SETTINGS.sprintSpeed : SETTINGS.walkSpeed;

        if (state.moveForward || state.moveBackward) {
            state.velocity.z -= state.direction.z * speed * delta;
        }
        if (state.moveLeft || state.moveRight) {
            state.velocity.x -= state.direction.x * speed * delta;
        }

        if (canSprint) {
            state.staminaLevel -= delta * SETTINGS.staminaDrain;
            if (state.staminaLevel < 0) state.staminaLevel = 0;
        } else if (!isMoving) {
            state.staminaLevel += delta * SETTINGS.staminaRegen;
            if (state.staminaLevel > 100) state.staminaLevel = 100;
        } else if (isMoving && (SETTINGS.staminaRegenWalking ?? 0) > 0) {
            state.staminaLevel += delta * (SETTINGS.staminaRegenWalking ?? 0);
            if (state.staminaLevel > 100) state.staminaLevel = 100;
        }

        const oldPos = state.camera.position.clone();

        state.controls.moveRight(-state.velocity.x * delta);
        state.controls.moveForward(-state.velocity.z * delta);

        const hitWall = segmentCollidesWithWalls(oldPos, state.camera.position);
        const hitEnemy = collidesWithEnemy(state.camera.position);

        const observed = state.isBlinking ? false : enemyIsObserved();

        if (hitWall || hitEnemy) {
            state.camera.position.copy(oldPos);
            state.velocity.set(0, 0, 0);
            if (hitEnemy) {
                triggerCaught();
            } else if (hitWall && !observed) {
                let enemySpeed = SETTINGS.enemySpeed + state.artifactsCollected * SETTINGS.enemySpeedPerArtifact;
                if (state.enemyBurstTime > 0) enemySpeed *= SETTINGS.enemyBurstMultiplier;
                const caught = moveEnemyStep(enemySpeed * delta, delta);
                if (caught) triggerCaught();
            }
        }

        const fill = dom('stamina-meter-fill');
        const container = dom('stamina-meter-container');
        if (fill) fill.style.width = Math.max(0, state.staminaLevel) + '%';
        if (container) {
            container.classList.toggle('low', state.staminaLevel <= 25);
            container.classList.toggle('regen', !isMoving && state.staminaLevel < 100);
        }

        if (state.forcedBlinkCooldown > 0) state.forcedBlinkCooldown -= delta;
        if (state.manualBlinkCooldown > 0) state.manualBlinkCooldown -= delta;
        if (!state.isBlinking) {
            const drainRate = isMoving ? SETTINGS.blinkDrainMoving : (SETTINGS.blinkDrainStill ?? 6);
            state.blinkLevel -= delta * drainRate;
            if (state.blinkLevel < 0) state.blinkLevel = 0;
            if (state.blinkLevel <= 0 && state.forcedBlinkCooldown <= 0) {
                performBlink(false);
                state.blinkLevel = 35;
                state.forcedBlinkCooldown = 2.5;
            }
        }
        const blinkFill = dom('blink-meter-fill');
        const blinkContainer = dom('blink-meter-container');
        if (blinkFill) blinkFill.style.width = Math.max(0, state.blinkLevel) + '%';
        if (blinkContainer) {
            blinkContainer.classList.toggle('low', state.blinkLevel <= 25);
            blinkContainer.classList.remove('regen');
        }
        const flashlightCharge = Math.max(0, Math.min(100, (1 - state.flashlightDim) * 100));
        const flashlightFill = dom('flashlight-meter-fill');
        const flashlightContainer = dom('flashlight-meter-container');
        if (flashlightFill) flashlightFill.style.width = flashlightCharge + '%';
        if (flashlightContainer) flashlightContainer.classList.toggle('low', flashlightCharge <= 25);

        let distToEnemy = Infinity;
        if (state.enemyModel) {
            distToEnemy = state.camera.position.distanceTo(state.enemyModel.position);
            state._distToEnemy = distToEnemy;
            const inCatchRange = distToEnemy <= SETTINGS.catchDistance;

            if (observed) {
                state.enemyWasObserved = true;
                state.enemyLastKnownPlayerPos = state.camera.position.clone();
                state.enemyLastKnownTime = performance.now() * 0.001;
            }
            if (observed && distToEnemy < SETTINGS.stareKillDistance) {
                state.lookingAtMonsterTime = (state.lookingAtMonsterTime || 0) + delta;
                const stareKillTime = state.stareSoundDuration ?? SETTINGS.stareKillTime;
                const stareEffectStart = state.stareEffectStart ?? SETTINGS.stareEffectStart;
                if (state.lookingAtMonsterTime >= stareKillTime) {
                    stopStareSound();
                    triggerCaught();
                } else {
                    const denom = Math.max(0.1, stareKillTime - stareEffectStart);
                    const effectProgress = Math.max(0, (state.lookingAtMonsterTime - stareEffectStart) / denom);
                    const vig = dom('stare-vignette');
                    if (vig) {
                        vig.classList.toggle('active', effectProgress > 0);
                        vig.style.opacity = String(Math.min(1, effectProgress * 1.2));
                    }
                    const crazy = dom('stare-crazy');
                    if (crazy) {
                        crazy.classList.toggle('visible', effectProgress > 0);
                        crazy.classList.toggle('shake', effectProgress > 0.4);
                    }
                    const stareWarning = dom('stare-warning');
                    const warnThreshold = SETTINGS.stareWarningThreshold ?? 0.5;
                    if (stareWarning) {
                        stareWarning.classList.toggle('visible', effectProgress >= warnThreshold && effectProgress < 0.95);
                    }
                    if (effectProgress > 0) playStareSound();
                    const vp = dom('game-viewport');
                    if (vp && effectProgress > 0) {
                        const shake = 2 + effectProgress * 6;
                        const sx = (Math.random() - 0.5) * 2 * shake;
                        const sy = (Math.random() - 0.5) * 2 * shake;
                        vp.style.transform = `translate(${sx}px, ${sy}px)`;
                    }
                }
            } else {
                if (!state.isBlinking) {
                    state.lookingAtMonsterTime = 0;
                }
                stopStareSound();
                const vig = dom('stare-vignette');
                if (vig) {
                    vig.classList.remove('active');
                    vig.style.opacity = '0';
                }
                dom('stare-warning')?.classList.remove('visible');
                const crazy = dom('stare-crazy');
                if (crazy) { crazy.classList.remove('visible'); crazy.classList.remove('shake'); }
                const vp = dom('game-viewport');
                if (vp) vp.style.transform = 'none';
            }

            if (inCatchRange && observed) {
                state.enemyInCatchRangeTime = (state.enemyInCatchRangeTime || 0) + delta;
                if (state.enemyInCatchRangeTime >= SETTINGS.catchGracePeriod) {
                    triggerCaught();
                }
            } else if (!inCatchRange) {
                state.enemyInCatchRangeTime = 0;
            }
        } else {
            state._distToEnemy = Infinity;
            state.enemyInCatchRangeTime = 0;
            state.lookingAtMonsterTime = 0;
            stopStareSound();
            const vig = dom('stare-vignette');
            if (vig) { vig.classList.remove('active'); vig.style.opacity = '0'; }
            dom('stare-warning')?.classList.remove('visible');
            const crazy = dom('stare-crazy');
            if (crazy) { crazy.classList.remove('visible'); crazy.classList.remove('shake'); }
            const vp = dom('game-viewport');
            if (vp) vp.style.transform = 'none';
        }

        if (!observed) {
            state.enemyInCatchRangeTime = 0;
            const prevObserved = state.enemyWasObserved;
            state.enemyWasObserved = false;
            if (prevObserved && state.enemyModel) {
                const burstDur = SETTINGS.enemyBurstDuration + state.artifactsCollected * (SETTINGS.enemyBurstDurationPerArtifact ?? 0);
                state.enemyBurstTime = Math.max(SETTINGS.enemyBurstDuration, burstDur);
            }
            if (state.enemyBurstTime > 0) {
                state.enemyBurstTime -= delta;
            }
            let enemySpeed = SETTINGS.enemySpeed + state.artifactsCollected * SETTINGS.enemySpeedPerArtifact;
            if (state.enemyBurstTime > 0) {
                enemySpeed *= SETTINGS.enemyBurstMultiplier;
            }
            const caught = moveEnemyStep(enemySpeed * delta, delta);
            if (caught) triggerCaught();
        }

        checkArtifacts();
        checkExitDoor();
        updateFlashlightAndTimer();
        updateSounds(observed, state._distToEnemy ?? Infinity);

        // Update exit door particles and glow
        const partGeo = state.exitDoorParticles?.geometry?.attributes?.position;
        if (state.exitDoor?.visible && partGeo && state.exitPosition && state.exitDoorParticleVelocities) {
            const positions = partGeo.array;
            const velocities = state.exitDoorParticleVelocities;
            const ex = state.exitPosition.x;
            const ez = state.exitPosition.z;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i] += velocities[i] * delta;
                positions[i + 1] += velocities[i + 1] * delta;
                positions[i + 2] += velocities[i + 2] * delta;
                const dx = positions[i] - ex;
                const dz = positions[i + 2] - ez;
                const dist = Math.hypot(dx, dz);
                if (dist > 4 || positions[i + 1] > 4) {
                    positions[i] = ex + (Math.random() - 0.5) * 3;
                    positions[i + 1] = 1.5 + Math.random() * 2;
                    positions[i + 2] = ez + (Math.random() - 0.5) * 3;
                    velocities[i] = (Math.random() - 0.5) * 0.5;
                    velocities[i + 1] = Math.random() * 0.3 + 0.1;
                    velocities[i + 2] = (Math.random() - 0.5) * 0.5;
                }
            }
            partGeo.needsUpdate = true;
        }

        state.prevTime = time;
    } else {
        stopAllSounds();
    }

    try {
        state.renderer.render(state.scene, state.camera);
    } catch (e) {
        console.warn('Render skipped:', e);
    }
    if (state._frameCount == null) state._frameCount = 0;
    state._frameCount++;
    if (state._frameCount % 4 === 0) updateMinimap();
}

window.addEventListener('resize', () => {
    if (!state.camera || !state.renderer) return;
    state.camera.aspect = window.innerWidth / window.innerHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(window.innerWidth / 2, window.innerHeight / 2, false);
});

dom('restart-btn')?.addEventListener('click', () => {
    window.location.reload();
});

window.addEventListener('DOMContentLoaded', () => {
    init();
    animate();
});
