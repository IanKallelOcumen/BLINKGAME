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
    // Calculate angle to rotate world so forward points up on screen
    // Forward direction in world: (forward.x, forward.z)
    // We want it to point to (0, -1) on screen (up)
    const yaw = Math.atan2(forward.x, forward.z);
    const cos = Math.cos(-yaw); // Negate to rotate world coordinates back
    const sin = Math.sin(-yaw);

    const worldToMap = (wx, wz) => {
        const dx = wx - px;
        const dz = wz - pz;
        // Rotate coordinates so forward points up
        const rx = dx * cos - dz * sin;
        const rz = dx * sin + dz * cos;
        const mx = cx + rx * scale;
        const my = cy - rz * scale; // Negative because screen Y is down
        return { mx, my };
    };
    
    // Calculate forward direction in rotated map space (should be (0, -1) = up)
    const forwardMapX = forward.x * cos - forward.z * sin;
    const forwardMapZ = forward.x * sin + forward.z * cos;

    const inBounds = (mx, my) => mx >= -10 && mx <= w + 10 && my >= -10 && my <= h + 10;

    ctx.fillStyle = '#555555';
    state.walls.forEach((wall) => {
        const m = worldToMap(wall.position.x, wall.position.z);
        if (!inBounds(m.mx, m.my)) return;
        const size = 5;
        ctx.fillRect(m.mx - size / 2, m.my - size / 2, size, size);
    });

    const p = { mx: cx, my: cy };

    // Draw flashlight cone SPREADING OUTWARD from player, rotating with camera direction
    const coneLength = 18;
    const coneBaseWidth = 6; // Narrow base at player (where light starts)
    const coneTipWidth = 16; // Wide tip spreading outward
    
    // After rotation, forward should point up (0, -1 in screen coords)
    // So forward in map space is: forwardMapX ≈ 0, forwardMapZ ≈ -1 (normalized)
    // Perpendicular (right) is: (1, 0) in map space
    // But we need to account for the actual forward direction
    
    // Normalize forward direction in map space
    const forwardLen = Math.hypot(forwardMapX, forwardMapZ);
    const forwardNormX = forwardLen > 0 ? forwardMapX / forwardLen : 0;
    const forwardNormZ = forwardLen > 0 ? forwardMapZ / forwardLen : -1; // Default to up
    
    // Perpendicular vector (right direction) - rotate forward 90 degrees
    const perpX = -forwardNormZ; // Right = rotate forward 90deg clockwise
    const perpZ = forwardNormX;
    
    // Base points (narrow, at player center) - spread perpendicular to forward
    const baseLeftX = cx - perpX * (coneBaseWidth / 2);
    const baseLeftY = cy - perpZ * (coneBaseWidth / 2);
    const baseRightX = cx + perpX * (coneBaseWidth / 2);
    const baseRightY = cy + perpZ * (coneBaseWidth / 2);
    
    // Tip center point (forward direction)
    const tipCenterX = cx - forwardNormX * coneLength; // Negative because screen Y is down
    const tipCenterY = cy - forwardNormZ * coneLength;
    
    // Tip points (wide, spreading outward) - spread perpendicular to forward
    const tipLeftX = tipCenterX - perpX * (coneTipWidth / 2);
    const tipLeftY = tipCenterY - perpZ * (coneTipWidth / 2);
    const tipRightX = tipCenterX + perpX * (coneTipWidth / 2);
    const tipRightY = tipCenterY + perpZ * (coneTipWidth / 2);
    
    // Draw as a spreading flashlight beam (narrow to wide, rotating with camera)
    ctx.fillStyle = 'rgba(255, 255, 200, 0.7)';
    ctx.strokeStyle = 'rgba(255, 255, 200, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(baseLeftX, baseLeftY); // Left side of narrow base
    ctx.lineTo(baseRightX, baseRightY); // Right side of narrow base
    ctx.lineTo(tipRightX, tipRightY); // Right side of wide tip
    ctx.lineTo(tipLeftX, tipLeftY); // Left side of wide tip
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

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
