/**
 * Level generation - maze, floor, walls with barrier, textures
 */
import * as THREE from 'three';
import { ASSETS } from './config.js';
import { state } from './state.js';

const CELL_SIZE = 4;
const WALL_HEIGHT = 5;
const MAZE_COLS = 11;
const MAZE_ROWS = 11;

function createRetroTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    if (type === 'wall') {
        ctx.fillStyle = '#444';
        ctx.fillRect(0, 0, 64, 64);
        for (let i = 0; i < 300; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#333' : '#555';
            ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, 64, 8);
    } else {
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillRect(32, 32, 32, 32);
        for (let i = 0; i < 100; i++) {
            ctx.fillStyle = 'rgba(100,50,50,0.2)';
            ctx.fillRect(Math.random() * 64, Math.random() * 64, 4, 4);
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function generateMazeGrid() {
    const rows = MAZE_ROWS * 2 + 1;
    const cols = MAZE_COLS * 2 + 1;
    const grid = Array(rows).fill(null).map(() => Array(cols).fill(1));

    function carve(r, c) {
        grid[r][c] = 0;
        const dirs = [
            [-2, 0], [2, 0], [0, -2], [0, 2]
        ];
        dirs.sort(() => Math.random() - 0.5);

        for (const [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && grid[nr][nc] === 1) {
                grid[Math.floor((r + nr) / 2)][Math.floor((c + nc) / 2)] = 0;
                carve(nr, nc);
            }
        }
    }

    carve(1, 1);
    return grid;
}

function createWallSegment(wallMat) {
    const geo = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    return new THREE.Mesh(geo, wallMat);
}

export function generateLevel() {
    const texLoader = new THREE.TextureLoader();
    const fallbackWall = createRetroTexture('wall');
    const fallbackFloor = createRetroTexture('floor');
    fallbackFloor.repeat.set(20, 20);

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshStandardMaterial({ map: fallbackFloor, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    state.scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ map: fallbackWall, roughness: 0.9 });

    const mazeGrid = generateMazeGrid();
    const rows = mazeGrid.length;
    const cols = mazeGrid[0].length;
    const offsetX = (cols * CELL_SIZE) / 2 - CELL_SIZE / 2;
    const offsetZ = (rows * CELL_SIZE) / 2 - CELL_SIZE / 2;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (mazeGrid[r][c] === 1) {
                const w = createWallSegment(wallMat);
                w.position.set(c * CELL_SIZE - offsetX, WALL_HEIGHT / 2, r * CELL_SIZE - offsetZ);
                state.scene.add(w);
                state.walls.push(w);
            }
        }
    }

    const boundary = 48;
    const segCount = Math.ceil((boundary * 2) / CELL_SIZE);
    for (let i = 0; i < segCount; i++) {
        const pos = -boundary + CELL_SIZE * (i + 0.5);
        const w1 = createWallSegment(wallMat);
        w1.position.set(pos, WALL_HEIGHT / 2, -boundary);
        state.scene.add(w1);
        state.walls.push(w1);
        const w2 = createWallSegment(wallMat);
        w2.position.set(pos, WALL_HEIGHT / 2, boundary);
        state.scene.add(w2);
        state.walls.push(w2);
    }
    for (let i = 0; i < segCount; i++) {
        const pos = -boundary + CELL_SIZE * (i + 0.5);
        const w1 = createWallSegment(wallMat);
        w1.position.set(-boundary, WALL_HEIGHT / 2, pos);
        state.scene.add(w1);
        state.walls.push(w1);
        const w2 = createWallSegment(wallMat);
        w2.position.set(boundary, WALL_HEIGHT / 2, pos);
        state.scene.add(w2);
        state.walls.push(w2);
    }

    texLoader.load(ASSETS.floorTexture, (tex) => {
        if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
        else if (tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(25, 25);
        floor.material.map = tex;
        floor.material.needsUpdate = true;
    });

    texLoader.load(ASSETS.wallTexture, (tex) => {
        if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
        else if (tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2.5);
        wallMat.map = tex;
        wallMat.needsUpdate = true;
    });

    const doorGeo = new THREE.BoxGeometry(2, 3, 0.5);
    const doorMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x00ff88,
        emissiveIntensity: 0.8,
        roughness: 0.3,
    });
    state.mazePassagePositions = [];
    let exitPos = null;
    for (let r = 1; r < rows - 1; r += 2) {
        for (let c = 1; c < cols - 1; c += 2) {
            const x = c * CELL_SIZE - offsetX;
            const z = r * CELL_SIZE - offsetZ;
            if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
            state.mazePassagePositions.push({ x, z });
            if (z < -35 && Math.abs(x) < 8 && !exitPos) exitPos = { x, z };
        }
    }
    if (!exitPos) exitPos = state.mazePassagePositions.find(p => p.z < 0) || { x: 0, z: -40 };
    state.exitPosition = exitPos;
    state.mazePassagePositions = state.mazePassagePositions.filter(
        p => Math.abs(p.x - exitPos.x) > 2 || Math.abs(p.z - exitPos.z) > 2
    );

    state.exitDoor = new THREE.Mesh(doorGeo, doorMat);
    state.exitDoor.position.set(exitPos.x, 1.5, exitPos.z);
    state.exitDoor.visible = false;
    state.scene.add(state.exitDoor);

    // Add glow light to exit door (hidden until exit opens)
    const doorGlow = new THREE.PointLight(0x00ff88, 0, 15);
    doorGlow.position.set(exitPos.x, 2, exitPos.z);
    state.scene.add(doorGlow);
    state.exitDoorGlow = doorGlow;

    // Create particles for exit door
    const particleCount = 30;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = exitPos.x + (Math.random() - 0.5) * 3;
        positions[i * 3 + 1] = 1.5 + Math.random() * 2;
        positions[i * 3 + 2] = exitPos.z + (Math.random() - 0.5) * 3;
        velocities[i * 3] = (Math.random() - 0.5) * 0.5;
        velocities[i * 3 + 1] = Math.random() * 0.3 + 0.1;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0x00ff88, size: 0.2, sizeAttenuation: true });
    const particles = new THREE.Points(particleGeo, particleMat);
    particles.visible = false;
    state.scene.add(particles);
    state.exitDoorParticles = particles;
    state.exitDoorParticleVelocities = velocities;

    const navSize = 48;
    const navCell = 2;
    const navMin = -48;
    const wallHalf = 2.7;
    state.navGrid = Array(navSize).fill(null).map(() => Array(navSize).fill(0));
    state.navGridSize = navSize;
    state.navCellSize = navCell;
    state.navMin = navMin;
    for (const w of state.walls) {
        const wx = w.position.x;
        const wz = w.position.z;
        const cMin = Math.max(0, Math.floor((wx - wallHalf - navMin) / navCell));
        const cMax = Math.min(navSize - 1, Math.floor((wx + wallHalf - navMin) / navCell));
        const rMin = Math.max(0, Math.floor((wz - wallHalf - navMin) / navCell));
        const rMax = Math.min(navSize - 1, Math.floor((wz + wallHalf - navMin) / navCell));
        for (let r = rMin; r <= rMax; r++) {
            for (let c = cMin; c <= cMax; c++) {
                state.navGrid[r][c] = 1;
            }
        }
    }
}
