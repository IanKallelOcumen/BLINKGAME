/**
 * Minimap rendering (no enemy icon - player, walls, artifacts, exit only)
 */
import * as THREE from 'three';
import { SETTINGS } from './config.js';
import { state } from './state.js';

export function updateMinimap() {
    if (state.isGameOver) return;
    const canvas = document.getElementById('minimap');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!state.walls || !state.camera) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, w, h);

    const worldSize = 100;
    const worldToMap = (x, z) => {
        const mx = ((x + worldSize / 2) / worldSize) * w;
        const my = h - ((z + worldSize / 2) / worldSize) * h;
        return { mx, my };
    };

    ctx.fillStyle = '#555555';
    state.walls.forEach((wall) => {
        const m = worldToMap(wall.position.x, wall.position.z);
        const size = 5;
        ctx.fillRect(m.mx - size / 2, m.my - size / 2, size, size);
    });

    const pPos = state.camera.position;
    const p = worldToMap(pPos.x, pPos.z);

    const forward = new THREE.Vector3();
    state.camera.getWorldDirection(forward);
    const angle = Math.atan2(-forward.z, forward.x);
    const coneAngle = Math.acos(SETTINGS.observationDotThreshold);
    const coneLength = Math.min(w / 2, h / 2) * 0.8;

    ctx.fillStyle = 'rgba(255, 255, 0, 0.15)';
    ctx.beginPath();
    ctx.moveTo(p.mx, p.my);
    ctx.arc(p.mx, p.my, coneLength, angle - coneAngle, angle + coneAngle);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.mx, p.my);
    ctx.lineTo(
        p.mx + Math.cos(angle - coneAngle) * coneLength,
        p.my + Math.sin(angle - coneAngle) * coneLength
    );
    ctx.moveTo(p.mx, p.my);
    ctx.lineTo(
        p.mx + Math.cos(angle + coneAngle) * coneLength,
        p.my + Math.sin(angle + coneAngle) * coneLength
    );
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.mx, p.my, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00ffff';
    (state.artifacts || []).forEach((art) => {
        const a = worldToMap(art.position.x, art.position.z);
        ctx.beginPath();
        ctx.arc(a.mx, a.my, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    if (state.exitDoor && state.exitDoor.visible) {
        const d = worldToMap(state.exitDoor.position.x, state.exitDoor.position.z);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#00ff00';
        const size = 6;
        ctx.fillRect(d.mx - size / 2, d.my - size / 2, size, size);
        ctx.strokeRect(d.mx - size / 2, d.my - size / 2, size, size);
    }
}
