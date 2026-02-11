/**
 * Minimap rendering (no enemy icon - player, walls, artifacts, exit only).
 * Rotating mode: player at center, forward = up.
 */
import * as THREE from 'three';
import { SETTINGS } from './config.js';
import { state } from './state.js';

const MINIMAP_RADIUS_WORLD = 28;

export function updateMinimap() {
    if (state.isGameOver) return;
    const canvas = document.getElementById('minimap');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!state.walls || !state.camera) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) / (2 * MINIMAP_RADIUS_WORLD);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);

    const px = state.camera.position.x;
    const pz = state.camera.position.z;
    const forward = new THREE.Vector3();
    state.camera.getWorldDirection(forward);
    // Yaw so that (forward.x, forward.z) maps to (0, 1) in map space -> up on screen
    // Fix: use negative x to correct left/right inversion
    const yaw = Math.atan2(-forward.x, forward.z);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);

    const worldToMap = (wx, wz) => {
        const dx = wx - px;
        const dz = wz - pz;
        // Rotate so forward direction points up on screen, correct left/right
        const rx = dx * cos - dz * sin;
        const rz = dx * sin + dz * cos;
        const mx = cx + rx * scale;
        const my = cy - rz * scale;
        return { mx, my };
    };

    const inBounds = (mx, my) => mx >= -10 && mx <= w + 10 && my >= -10 && my <= h + 10;

    ctx.fillStyle = '#555555';
    state.walls.forEach((wall) => {
        const m = worldToMap(wall.position.x, wall.position.z);
        if (!inBounds(m.mx, m.my)) return;
        const size = 5;
        ctx.fillRect(m.mx - size / 2, m.my - size / 2, size, size);
    });

    const p = { mx: cx, my: cy };

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.mx, p.my, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 255, 255, 1)';
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    (state.artifacts || []).forEach((art) => {
        const a = worldToMap(art.position.x, art.position.z);
        if (!inBounds(a.mx, a.my)) return;
        ctx.beginPath();
        ctx.arc(a.mx, a.my, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    });

    if (state.exitDoor && state.exitDoor.visible) {
        const d = worldToMap(state.exitDoor.position.x, state.exitDoor.position.z);
        if (inBounds(d.mx, d.my)) {
            ctx.fillStyle = '#00ff88';
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 2;
            const size = 8;
            ctx.fillRect(d.mx - size / 2, d.my - size / 2, size, size);
            ctx.strokeRect(d.mx - size / 2, d.my - size / 2, size, size);
        }
    }
}
