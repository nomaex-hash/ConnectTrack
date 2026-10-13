import { describe, expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { GamePhase } from '../../../assets/scripts/application/contracts/gameSnapshot';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import {
    buildTrainPolyline,
    poseAtDistance,
    polylineLength,
    traceTrainPath,
    roundTrainCorners,
} from '../../../assets/scripts/presentation/board/trainPath';
import { TEST_LEVEL } from '../domain/fixtures';

/** TEST_LEVEL (3x3): solution path 0 -> 1 -> 2 -> 5 -> 8. Given: 0, 8. a = Left, b = Down. */
function wonSession(): GameSession {
    const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
    session.dispatch({ type: 'doubleTapCell', cell: 1 });
    session.dispatch({ type: 'beginTrackDrag', cell: 1 });
    session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 0 });
    session.dispatch({ type: 'endTrackDrag' });
    session.dispatch({ type: 'beginTrackDrag', cell: 1 });
    session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 2 });
    session.dispatch({ type: 'trackBoundaryCrossed', from: 2, to: 5 });
    session.dispatch({ type: 'trackBoundaryCrossed', from: 5, to: 8 });
    return session;
}

describe('traceTrainPath', () => {
    it('recovers the exact solution path once Won', () => {
        const snapshot = wonSession().snapshot();
        expect(snapshot.phase).toBe(GamePhase.Won);
        expect(traceTrainPath(snapshot)).toEqual([0, 1, 2, 5, 8]);
    });

    it('returns null before the path is fully connected', () => {
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        expect(traceTrainPath(session.snapshot())).toBeNull();
    });

    it('returns null for a partially connected path (Track ? only)', () => {
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        session.dispatch({ type: 'doubleTapCell', cell: 1 });
        session.dispatch({ type: 'beginTrackDrag', cell: 1 });
        session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 2 });
        expect(traceTrainPath(session.snapshot())).toBeNull();
    });
});

describe('buildTrainPolyline / poseAtDistance', () => {
    it('extends one cellSize past the entrance (outward a) and the exit (outward b)', () => {
        const path = [0, 1, 2, 5, 8];
        const polyline = buildTrainPolyline(path, 3, 3, 100, Direction.Left, Direction.Down);
        // Cell 0 centre: (-100, 100). Entrance is BEFORE it, extended Left (outward a): (-200, 100).
        expect(polyline[0]).toEqual({ x: -200, y: 100 });
        // Cell 8 centre: (100, -100). Exit is AFTER it, extended Down (outward b): (100, -200).
        expect(polyline[polyline.length - 1]).toEqual({ x: 100, y: -200 });
        expect(polyline.length).toBeGreaterThan(path.length + 2);
    });

    it('poseAtDistance walks along the polyline and reports facing direction', () => {
        const polyline = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
        ];
        expect(poseAtDistance(polyline, 0)).toEqual({ point: { x: 0, y: 0 }, angleDeg: 0 });
        expect(poseAtDistance(polyline, 50)).toEqual({ point: { x: 50, y: 0 }, angleDeg: 0 });
        const turned = poseAtDistance(polyline, 150);
        expect(turned?.point).toEqual({ x: 100, y: 50 });
        expect(turned?.angleDeg).toBeCloseTo(90);
    });

    it('poseAtDistance returns null once past the end of the polyline', () => {
        const polyline = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
        ];
        expect(poseAtDistance(polyline, 100)).not.toBeNull();
        expect(poseAtDistance(polyline, 100.0001)).toBeNull();
    });

    it('polylineLength sums every segment', () => {
        const polyline = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
        ];
        expect(polylineLength(polyline)).toBe(200);
    });

    it('rounds both turn directions with intermediate tangent angles', () => {
        for (const sign of [-1, 1]) {
            const points = roundTrainCorners([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: sign * 100 }], 50);
            const arc = points.filter(p => p.heading !== undefined);
            expect(arc).toHaveLength(25);
            expect(arc[0].x).toBeCloseTo(50);
            expect(arc[0].y).toBeCloseTo(0);
            expect(arc[24].x).toBeCloseTo(100);
            expect(arc[24].y).toBeCloseTo(sign * 50);
            const middle = poseAtDistance(points, polylineLength(points) / 2)!;
            expect(middle.angleDeg).toBeCloseTo(sign * 45);
            expect(Math.hypot(middle.point.x - 50, middle.point.y - sign * 50)).toBeCloseTo(50);
            expect(polylineLength(points)).toBeCloseTo(100 + Math.PI * 25, 1);
        }
    });

    it('keeps consecutive curves continuous and positions finite', () => {
        const points = roundTrainCorners([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 100 }], 50);
        let previous = poseAtDistance(points, 0)!;
        for (let d = 1; d < polylineLength(points); d++) {
            const pose = poseAtDistance(points, d)!;
            expect(Number.isFinite(pose.point.x)).toBe(true);
            const delta = ((pose.angleDeg - previous.angleDeg + 540) % 360) - 180;
            expect(Math.abs(delta)).toBeLessThan(2);
            expect(Math.hypot(pose.point.x - previous.point.x, pose.point.y - previous.point.y)).toBeLessThanOrEqual(1.001);
            previous = pose;
        }
    });
});
