/**
 * A* pathfinding for maze navigation
 */
import { state } from './state.js';

function worldToGrid(x, z) {
    const { navGridSize, navCellSize, navMin } = state;
    if (!navGridSize || !state.navGrid) return null;
    const c = Math.floor((x - navMin) / navCellSize);
    const r = Math.floor((z - navMin) / navCellSize);
    if (r < 0 || r >= navGridSize || c < 0 || c >= navGridSize) return null;
    return { r, c };
}

function gridToWorld(r, c) {
    const { navCellSize, navMin } = state;
    const x = navMin + (c + 0.5) * navCellSize;
    const z = navMin + (r + 0.5) * navCellSize;
    return { x, z };
}

function getNeighbors(r, c) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    return dirs.map(([dr, dc]) => ({ r: r + dr, c: c + dc }));
}

function isWalkable(r, c) {
    const { navGrid, navGridSize } = state;
    if (!navGrid) return false;
    if (r < 0 || r >= navGridSize || c < 0 || c >= navGridSize) return false;
    return navGrid[r][c] === 0;
}

function findNearestWalkable(worldX, worldZ, maxDist = 5) {
    const { navGridSize, navCellSize, navMin } = state;
    if (!state.navGrid) return null;
    const center = worldToGrid(worldX, worldZ);
    if (!center) return null;
    if (isWalkable(center.r, center.c)) return center;
    for (let d = 1; d <= maxDist; d++) {
        let best = null;
        let bestDist = Infinity;
        for (let r = Math.max(0, center.r - d); r <= Math.min(navGridSize - 1, center.r + d); r++) {
            for (let c = Math.max(0, center.c - d); c <= Math.min(navGridSize - 1, center.c + d); c++) {
                if (!isWalkable(r, c)) continue;
                const dist = Math.abs(r - center.r) + Math.abs(c - center.c);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = { r, c };
                }
            }
        }
        if (best) return best;
    }
    return null;
}

export function findPath(startX, startZ, endX, endZ) {
    let start = worldToGrid(startX, startZ);
    let end = worldToGrid(endX, endZ);
    if (!start) start = findNearestWalkable(startX, startZ);
    if (!end) end = findNearestWalkable(endX, endZ);
    if (!start || !end || !isWalkable(start.r, start.c) || !isWalkable(end.r, end.c)) {
        return [];
    }
    if (start.r === end.r && start.c === end.c) return [];

    const open = [{ ...start, g: 0, h: 0, f: 0 }];
    const cameFrom = {};
    const gScore = { [`${start.r},${start.c}`]: 0 };
    const closed = new Set();

    while (open.length > 0) {
        let bestIdx = 0;
        let bestF = open[0].f;
        for (let i = 1; i < open.length; i++) {
            if (open[i].f < bestF) { bestF = open[i].f; bestIdx = i; }
        }
        const current = open.splice(bestIdx, 1)[0];
        const key = `${current.r},${current.c}`;
        if (closed.has(key)) continue;
        closed.add(key);

        if (current.r === end.r && current.c === end.c) {
            const path = [];
            let cur = current;
            while (cur) {
                const pos = gridToWorld(cur.r, cur.c);
                path.unshift(pos);
                cur = cameFrom[`${cur.r},${cur.c}`];
            }
            return path.slice(1);
        }

        for (const next of getNeighbors(current.r, current.c)) {
            if (!isWalkable(next.r, next.c)) continue;
            const dr = next.r - current.r;
            const dc = next.c - current.c;
            if (dr !== 0 && dc !== 0 && (!isWalkable(current.r + dr, current.c) || !isWalkable(current.r, current.c + dc))) continue;
            const nextKey = `${next.r},${next.c}`;
            const dist = Math.abs(dr) + Math.abs(dc) === 2 ? 1.414 : 1;
            const tentativeG = (gScore[key] || Infinity) + dist;
            if (tentativeG >= (gScore[nextKey] ?? Infinity)) continue;

            cameFrom[nextKey] = current;
            gScore[nextKey] = tentativeG;
            const h = Math.abs(next.r - end.r) + Math.abs(next.c - end.c);
            open.push({ ...next, g: tentativeG, h, f: tentativeG + h });
        }
    }
    return [];
}
