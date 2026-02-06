/**
 * Enemy logic - loading, setup, movement, observation
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSETS, SETTINGS } from './config.js';
import { state } from './state.js';
import { findPath } from './pathfinding.js';

const PATH_UPDATE_INTERVAL = 0.2;

export function loadGameAssets(hideLoading) {
    const loader = new GLTFLoader();

    loader.load(
        ASSETS.enemy,
        (gltf) => {
            state.pendingEnemyModel = gltf.scene;
            applyEnemyTexture(state.pendingEnemyModel);
            prepareEnemy(state.pendingEnemyModel);
            hideLoading();
        },
        undefined,
        (err) => {
            console.error('Failed to load enemy:', err);
            const geo = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
            const mat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.1 });
            const mesh = new THREE.Mesh(geo, mat);
            state.pendingEnemyModel = mesh;
            prepareEnemy(mesh);
            hideLoading();
        }
    );

    const passages = [...(state.mazePassagePositions || [])];
    const positions = [];
    for (let i = 0; i < 5 && passages.length > 0; i++) {
        const idx = Math.floor(Math.random() * passages.length);
        positions.push(passages.splice(idx, 1)[0]);
    }

    const artifactGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const artifactMat = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00aaff,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.5,
    });

    positions.forEach((pos) => {
        const mesh = new THREE.Mesh(artifactGeo, artifactMat);
        const glowLight = new THREE.PointLight(0x00ffff, 2, 6, 1.5);
        glowLight.position.set(0, 0, 0);
        mesh.add(glowLight);
        setupArtifact(mesh, pos);
    });
}

function applyEnemyTexture(model) {
    const texLoader = new THREE.TextureLoader();
    texLoader.load(
        ASSETS.enemyTexture,
        (tex) => {
            tex.flipY = false;
            if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
            else if (tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding;
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (!child.material) {
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0xffffff,
                            roughness: 0.6,
                            metalness: 0.1,
                        });
                    }
                    child.material.map = tex;
                    child.material.needsUpdate = true;
                    child.material.emissive.setHex(0x111111);
                }
            });
        },
        undefined,
        () => {
            model.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.color.setHex(0xffffff);
                    child.material.emissive.setHex(0x222222);
                }
            });
        }
    );
}

function prepareEnemy(model) {
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (!child.material) {
                child.material = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    roughness: 0.6,
                    metalness: 0.1,
                });
            }
            if (child.material && !child.material.map) {
                child.material.color.setHex(0xffffff);
                child.material.emissive.setHex(0x111111);
            }
        }
    });

    model.position.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.rotation.set(Math.PI, 0, 0);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const height = box.max.y - box.min.y;
    state.enemyFloorY = -box.min.y;
    if (height <= 0 || state.enemyFloorY > 5) {
        state.enemyFloorY = Math.max(0.5, height * 0.5);
    }

    const passages = state.mazePassagePositions || [];
    const farPassages = passages.filter(p => p.x * p.x + p.z * p.z > 100);
    const spawn = farPassages.length > 0
        ? farPassages[Math.floor(Math.random() * farPassages.length)]
        : { x: 20, z: 20 };
    model.position.set(spawn.x, state.enemyFloorY, spawn.z);
    model.scale.set(1, 1, 1);
}

function getTeleportScarePosition() {
    const pPos = state.camera.position;
    const passages = state.mazePassagePositions || [];
    const minD = SETTINGS.teleportScareMin ?? 6;
    const maxD = SETTINGS.teleportScareMax ?? 14;
    const candidates = passages.filter(p => {
        const d = Math.hypot(p.x - pPos.x, p.z - pPos.z);
        return d >= minD && d <= maxD;
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function getSpawnNearPlayer() {
    const pPos = state.camera.position;
    const passages = state.mazePassagePositions || [];
    const minDist = 12;
    const maxDist = 24;
    const nearby = passages.filter(p => {
        const d = Math.hypot(p.x - pPos.x, p.z - pPos.z);
        return d >= minDist && d <= maxDist;
    });
    if (nearby.length > 0) {
        return nearby[Math.floor(Math.random() * nearby.length)];
    }
    const anyInRange = passages.filter(p => {
        const d = Math.hypot(p.x - pPos.x, p.z - pPos.z);
        return d >= 8 && d <= 30;
    });
    if (anyInRange.length > 0) {
        return anyInRange[Math.floor(Math.random() * anyInRange.length)];
    }
    return passages.length > 0
        ? passages[Math.floor(Math.random() * passages.length)]
        : { x: 15, z: 15 };
}

export function spawnEnemy() {
    if (!state.pendingEnemyModel || state.enemyModel) return;
    const mesh = state.pendingEnemyModel;
    mesh.position.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    const group = new THREE.Group();
    group.add(mesh);
    const spawn = getSpawnNearPlayer();
    group.position.set(spawn.x, state.enemyFloorY, spawn.z);
    group.userData.meshRoot = group;
    state.enemyModel = group;
    state.enemyPath = null;
    state.scene.add(state.enemyModel);
    state.pendingEnemyModel = null;
}

function createArtifactParticles(artifact) {
    const count = 24;
    const positions = new Float32Array(count * 3);
    const radius = 0.7;
    for (let i = 0; i < count; i++) {
        const theta = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const phi = Math.random() * Math.PI * 0.5;
        positions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
        positions[i * 3 + 1] = Math.cos(phi) * radius + 0.3;
        positions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        color: 0x00ffff,
        size: 0.08,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
    });
    const particles = new THREE.Points(geo, mat);
    particles.userData.basePositions = positions.slice();
    particles.userData.time = Math.random() * 100;
    artifact.add(particles);
    return particles;
}

function setupArtifact(model, pos) {
    model.position.set(pos.x, 1, pos.z);
    createArtifactParticles(model);
    state.scene.add(model);
    state.artifacts.push(model);
}

const ENEMY_RADIUS = 0.45;

function enemyCollidesWithWalls(pos) {
    for (const w of state.walls) {
        const dx = pos.x - w.position.x;
        const dz = pos.z - w.position.z;
        const halfSize = 2;
        if (Math.abs(dx) < halfSize + ENEMY_RADIUS && Math.abs(dz) < halfSize + ENEMY_RADIUS) {
            return true;
        }
    }
    return false;
}

function tryFindValidStep(fromPos, preferredDir, maxStep) {
    const angles = [0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75, 1.0, -1.0, 1.25, -1.25, 1.5, -1.5, 2.0, -2.0];
    for (const angle of angles) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = preferredDir.x * cos - preferredDir.z * sin;
        const dz = preferredDir.x * sin + preferredDir.z * cos;
        const tryPos = fromPos.clone().add(new THREE.Vector3(dx, 0, dz).multiplyScalar(maxStep));
        tryPos.y = state.enemyFloorY;
        if (!enemyCollidesWithWalls(tryPos)) {
            return tryPos;
        }
    }
    return null;
}

const STUCK_PATH_THROTTLE = 1.5;

export function moveEnemyStep(maxStep, deltaTime) {
    if (!state.enemyModel || maxStep <= 0) return false;

    const pPos = state.camera.position;
    const ePos = state.enemyModel.position;
    const distanceBefore = ePos.distanceTo(pPos);

    if (distanceBefore <= SETTINGS.catchDistance) return true;

    const dt = deltaTime || 0;
    const now = performance.now() * 0.001;
    const teleCooldown = SETTINGS.teleportCooldown ?? 25;
    const canTeleport = (now - (state.enemyLastTeleportTime || 0)) >= teleCooldown;
    if (canTeleport && Math.random() < 0.0015) {
        const tele = getTeleportScarePosition();
        if (tele) {
            state.enemyModel.position.set(tele.x, state.enemyFloorY, tele.z);
            state.enemyPath = null;
            state.enemyLastTeleportTime = now;
        }
    }
    state.enemyPathTime = (state.enemyPathTime || 0) + dt;
    const stuckThrottle = (state.enemyStuckFrames || 0) > 5 ? STUCK_PATH_THROTTLE : 1;
    const farThrottle = distanceBefore > 25 ? 1.5 : 1;
    const closeThrottle = distanceBefore < 5 ? 4 : distanceBefore < 10 ? 2.2 : 1;
    const useDirectMovement = distanceBefore < 3.5;
    const pathStale = !useDirectMovement && (!state.enemyPath || state.enemyPath.length === 0 || state.enemyPathTime > PATH_UPDATE_INTERVAL * stuckThrottle * farThrottle * closeThrottle);
    if (pathStale) {
        state.enemyPath = findPath(ePos.x, ePos.z, pPos.x, pPos.z);
        state.enemyPathTime = 0;
    }
    if (useDirectMovement) {
        state.enemyPath = null;
    }

    let targetX = null;
    let targetZ = null;
    if (state.enemyPath && state.enemyPath.length > 0) {
        const next = state.enemyPath[0];
        const distToNext = ePos.distanceTo(new THREE.Vector3(next.x, 0, next.z));
        if (distToNext < 0.8) {
            state.enemyPath.shift();
        }
        if (state.enemyPath.length > 0) {
            targetX = state.enemyPath[0].x;
            targetZ = state.enemyPath[0].z;
        }
    }

    if (targetX === null || targetZ === null) {
        const dirToPlayer = new THREE.Vector3(pPos.x - ePos.x, 0, pPos.z - ePos.z);
        if (dirToPlayer.length() >= 0.01) {
            dirToPlayer.normalize();
            const fallbackPos = tryFindValidStep(ePos, dirToPlayer, maxStep);
            if (fallbackPos) {
                targetX = fallbackPos.x;
                targetZ = fallbackPos.z;
            }
        }
    }

    if (targetX === null || targetZ === null) {
        return ePos.distanceTo(pPos) <= SETTINGS.catchDistance;
    }

    const dir = new THREE.Vector3(targetX - ePos.x, 0, targetZ - ePos.z);
    const len = dir.length();
    if (len < 0.01) return ePos.distanceTo(pPos) <= SETTINGS.catchDistance;

    dir.normalize();

    let targetDistance = distanceBefore - maxStep;
    if (distanceBefore > SETTINGS.minEnemyDistance + SETTINGS.catchDistance) {
        targetDistance = Math.max(targetDistance, SETTINGS.minEnemyDistance * 0.8);
    }
    const step = Math.min(maxStep, len, Math.max(0, distanceBefore - targetDistance));

    const beforeMove = state.enemyModel.position.clone();
    if (step > 0) {
        const newEnemyPos = ePos.clone().add(dir.multiplyScalar(step));
        newEnemyPos.y = state.enemyFloorY;

        if (!enemyCollidesWithWalls(newEnemyPos)) {
            state.enemyModel.position.copy(newEnemyPos);
            state.enemyStuckFrames = 0;
        } else {
            const dirToTarget = new THREE.Vector3(targetX - ePos.x, 0, targetZ - ePos.z).normalize();
            let slidePos = tryFindValidStep(ePos, dirToTarget, maxStep);
            if (!slidePos) {
                slidePos = tryFindValidStep(ePos, dirToTarget, maxStep * 0.6);
            }
            if (!slidePos) {
                const towardPlayer = new THREE.Vector3(pPos.x - ePos.x, 0, pPos.z - ePos.z).normalize();
                slidePos = tryFindValidStep(ePos, towardPlayer, maxStep * 0.5);
            }
            if (slidePos) {
                state.enemyModel.position.copy(slidePos);
                state.enemyPath = null;
                state.enemyStuckFrames = 0;
            } else {
                state.enemyStuckFrames = (state.enemyStuckFrames || 0) + 1;
            }
        }
    }

    const moved = state.enemyModel.position.distanceTo(beforeMove) > 0.001;
    if (!moved) {
        if (state.enemyPath?.length > 0 || targetX !== null) {
            state.enemyPathTime = PATH_UPDATE_INTERVAL + 0.1;
            state.enemyStuckFrames = (state.enemyStuckFrames || 0) + 1;
            if (state.enemyStuckFrames >= 4 && canTeleport) {
                const tele = getTeleportScarePosition();
                if (tele) {
                    state.enemyModel.position.set(tele.x, state.enemyFloorY, tele.z);
                    state.enemyPath = null;
                    state.enemyLastTeleportTime = now;
                }
                state.enemyStuckFrames = 0;
            }
        }
    }

    const lookY = state.enemyFloorY + 1.6;
    const root = state.enemyModel.userData.meshRoot || state.enemyModel;
    root.lookAt(pPos.x, lookY, pPos.z);

    const huntSpin = (state.enemyHuntSpin ?? 0) + (deltaTime || 0) * 3;
    state.enemyHuntSpin = huntSpin;
    const mesh = state.enemyModel.children[0];
    if (mesh) mesh.rotation.z = Math.sin(huntSpin) * 0.06;

    return state.enemyModel.position.distanceTo(pPos) <= SETTINGS.catchDistance;
}

let _cachedBlocking = null;
let _cachedExitVisible = false;

function getBlockingObjects() {
    if (!state.walls) return [];
    const exitVis = state.exitDoor?.visible ?? false;
    if (_cachedBlocking && _cachedExitVisible === exitVis) return _cachedBlocking;
    _cachedBlocking = state.walls.slice();
    if (exitVis) _cachedBlocking.push(state.exitDoor);
    _cachedExitVisible = exitVis;
    return _cachedBlocking;
}

const OBSERVED_RAYCAST_SKIP_DIST = 2.5;

export function enemyIsObserved() {
    if (!state.enemyModel) return false;

    const camPos = state.camera.position;
    const enemyPos = state.enemyModel.position;
    const toEnemy = new THREE.Vector3().subVectors(enemyPos, camPos);
    const maxDist = toEnemy.length();
    if (maxDist < 0.1) return true;
    toEnemy.normalize();

    const forward = new THREE.Vector3();
    state.camera.getWorldDirection(forward);
    const dot = forward.dot(toEnemy);
    if (dot <= SETTINGS.observationDotThreshold) return false;

    if (maxDist < OBSERVED_RAYCAST_SKIP_DIST) return true;

    const raycaster = new THREE.Raycaster();
    raycaster.set(camPos, toEnemy);
    raycaster.far = maxDist - 0.05;
    const blocking = getBlockingObjects();
    const hits = raycaster.intersectObjects(blocking, false);
    if (hits.length > 0) return false;

    return true;
}
