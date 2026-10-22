import { Direction, oppositeOf } from '../../domain/board/direction';
import { BoardSize, neighborIndex } from '../../domain/board/cellIndex';
import { GameSnapshot } from '../../application/contracts/gameSnapshot';

/**
 * Traces the single connected path from the entrance (s[0]) to the exit (s[-1]), following each
 * cell's exactly-2 ports — Main Track's fixed ports for a given cell, or the player's own 2 links
 * once a cell is a completed Track. Pure data, no Cocos: used to animate the train once Won.
 *
 * Returns null if the path cannot be traced (a cell along the way is not fully connected, or the
 * trace loops back on itself without ever reaching the exit). The caller should only call this once
 * snapshot.phase is Won, when every required cell has exactly 2 connections — tracing is not a
 * substitute for the Win rule itself (see domain/rules/winRule.ts), only a presentation helper.
 */
export function traceTrainPath(snapshot: GameSnapshot): readonly number[] | null {
    const size: BoardSize = { width: snapshot.width, height: snapshot.height };
    const portsByCell = new Map<number, readonly Direction[]>();
    for (const entry of snapshot.mainTrackPorts) {
        portsByCell.set(entry.cell, entry.directions);
    }
    snapshot.cellLinks.forEach((links, cell) => {
        if (links.length === 2) {
            portsByCell.set(cell, links);
        }
    });

    const entranceEntry = snapshot.mainTrackPorts.find((entry) => entry.cell === snapshot.entranceCell);
    if (!entranceEntry || entranceEntry.outward === null) {
        return null;
    }
    const startDirection = entranceEntry.directions.find((direction) => direction !== entranceEntry.outward);
    if (startDirection === undefined) {
        return null;
    }

    const path: number[] = [snapshot.entranceCell];
    const visited = new Set<number>(path);
    let current = snapshot.entranceCell;
    let goingToward = startDirection;

    while (current !== snapshot.exitCell) {
        const next = neighborIndex(size, current, goingToward);
        if (next === null || visited.has(next)) {
            return null; // Dead end, or a loop that never reaches the exit.
        }
        path.push(next);
        visited.add(next);
        current = next;
        if (current === snapshot.exitCell) {
            break;
        }
        const ports = portsByCell.get(current);
        if (!ports || ports.length !== 2) {
            return null; // Not fully connected yet.
        }
        const enteredFrom = oppositeOf(goingToward);
        const leavingToward = ports.find((direction) => direction !== enteredFrom);
        if (leavingToward === undefined) {
            return null;
        }
        goingToward = leavingToward;
    }
    return Object.freeze(path);
}

export interface Point {
    readonly x: number;
    readonly y: number;
    /** Optional tangent for a sampled curve, in degrees. */
    readonly heading?: number;
}

/** Unit vector (local X, Y) for each direction — Up is +Y (board space), matching the rest of the
 * board/cell positioning code (e.g. connectTracksCellView.ts's entrance offset table). */
const DIRECTION_UNIT: Readonly<Record<Direction, Point>> = {
    [Direction.Up]: { x: 0, y: 1 },
    [Direction.Down]: { x: 0, y: -1 },
    [Direction.Left]: { x: -1, y: 0 },
    [Direction.Right]: { x: 1, y: 0 },
};

/**
 * Builds the polyline of local (Board-space) points the train travels along: the centre of every
 * cell in `path`, extended by exactly one more cellSize step BEFORE the entrance and AFTER the exit
 * (in their outward directions) — so the train visibly arrives from off-board and leaves off-board,
 * instead of popping in/out exactly at the edge cell's centre.
 *
 * `cornerRadius` controls how early a turn starts rounding before reaching a cell's centre
 * (defaults to `cellSize / 2`, matching the real train's look). Pass 0 for sharp corners exactly AT
 * each cell centre — confirmed by the user: the tutorial's own dash/hand demo must reach a cell's
 * centre before it's allowed to turn, never rounding the corner early.
 */
export function buildTrainPolyline(
    path: readonly number[],
    width: number,
    height: number,
    cellSize: number,
    entranceOutward: Direction,
    exitOutward: Direction,
    cornerRadius: number = cellSize / 2,
): Point[] {
    const gridWidth = width * cellSize;
    const gridHeight = height * cellSize;
    const centerOf = (cell: number): Point => {
        const column = cell % width;
        const row = Math.floor(cell / width);
        return {
            x: -gridWidth / 2 + (column + 0.5) * cellSize,
            y: gridHeight / 2 - (row + 0.5) * cellSize,
        };
    };
    const points = path.map(centerOf);
    const first = points[0];
    const last = points[points.length - 1];
    const entranceUnit = DIRECTION_UNIT[entranceOutward];
    const exitUnit = DIRECTION_UNIT[exitOutward];
    const before: Point = { x: first.x + entranceUnit.x * cellSize, y: first.y + entranceUnit.y * cellSize };
    const after: Point = { x: last.x + exitUnit.x * cellSize, y: last.y + exitUnit.y * cellSize };
    return roundTrainCorners([before].concat(points, [after]), cornerRadius);
}

/** Quarter-circle bends join cell-edge midpoints, keeping the train inside curved rail cells. */
export function roundTrainCorners(points: readonly Point[], radius: number): Point[] {
    if (points.length < 3 || radius <= 0) return points.slice();
    const result: Point[] = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
        const a = points[i - 1], b = points[i], c = points[i + 1];
        const incomingLength = Math.hypot(b.x - a.x, b.y - a.y);
        const outgoingLength = Math.hypot(c.x - b.x, c.y - b.y);
        if (!incomingLength || !outgoingLength) { result.push(b); continue; }
        const ux = (b.x - a.x) / incomingLength, uy = (b.y - a.y) / incomingLength;
        const vx = (c.x - b.x) / outgoingLength, vy = (c.y - b.y) / outgoingLength;
        if (Math.abs(ux * vx + uy * vy) > 1e-6) { result.push(b); continue; }
        const r = Math.min(radius, incomingLength / 2, outgoingLength / 2);
        const entry = { x: b.x - ux * r, y: b.y - uy * r };
        const center = { x: entry.x + vx * r, y: entry.y + vy * r };
        const sign = Math.sign(ux * vy - uy * vx);
        const start = Math.atan2(entry.y - center.y, entry.x - center.x);
        const heading = Math.atan2(uy, ux);
        for (let step = 0; step <= 24; step++) {
            const turn = sign * Math.PI / 2 * step / 24;
            result.push({
                x: center.x + Math.cos(start + turn) * r,
                y: center.y + Math.sin(start + turn) * r,
                heading: (heading + turn) * 180 / Math.PI,
            });
        }
    }
    result.push(points[points.length - 1]);
    return result;
}

export function polylineLength(polyline: readonly Point[]): number {
    let total = 0;
    for (let i = 0; i + 1 < polyline.length; i++) {
        total += Math.hypot(polyline[i + 1].x - polyline[i].x, polyline[i + 1].y - polyline[i].y);
    }
    return total;
}

export interface PoseAtDistance {
    readonly point: Point;
    /** Direction of travel at this point, in degrees, 0 = facing +X (right). */
    readonly angleDeg: number;
}

/**
 * Position + facing direction at `distance` along `polyline`, or null once `distance` has gone
 * past the whole polyline — the caller hides whatever it's moving (engine/car) when this is null.
 */
export function poseAtDistance(polyline: readonly Point[], distance: number): PoseAtDistance | null {
    if (polyline.length < 2 || distance < 0) {
        return null;
    }
    let remaining = distance;
    for (let i = 0; i + 1 < polyline.length; i++) {
        const a = polyline[i];
        const b = polyline[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const segmentLength = Math.hypot(dx, dy);
        if (segmentLength < 1e-8) continue;
        if (remaining <= segmentLength) {
            const t = segmentLength > 0 ? remaining / segmentLength : 0;
            const segmentAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
            const startAngle = a.heading ?? segmentAngle;
            const endAngle = b.heading ?? segmentAngle;
            const delta = ((endAngle - startAngle + 540) % 360) - 180;
            return {
                point: { x: a.x + dx * t, y: a.y + dy * t },
                angleDeg: startAngle + delta * t,
            };
        }
        remaining -= segmentLength;
    }
    return null;
}
