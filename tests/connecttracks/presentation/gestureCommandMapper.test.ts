import { describe, expect, it } from 'vitest';
import {
    cellAtGridPoint,
    gestureToCommand,
    PlayerGesture,
} from '../../../assets/scripts/presentation/input/gestureCommandMapper';

describe('gesture to command mapping', () => {
    it('maps each semantic gesture to its neutral Application command', () => {
        const cases: readonly [PlayerGesture, unknown][] = [
            [{ kind: 'tap', cell: 3 }, { type: 'tapCell', cell: 3 }],
            [{ kind: 'doubleTap', cell: 4 }, { type: 'doubleTapCell', cell: 4 }],
            [{ kind: 'emptyDragBatch', cells: [3, 4] }, { type: 'markCellsAsX', cells: [3, 4] }],
            [{ kind: 'xDragBatch', cells: [3] }, { type: 'removeXCells', cells: [3] }],
            [{ kind: 'trackDragBegin', cell: 1 }, { type: 'beginTrackDrag', cell: 1 }],
            [{ kind: 'trackBoundaryStep', from: 1, to: 2 }, { type: 'trackBoundaryCrossed', from: 1, to: 2 }],
            [{ kind: 'trackDragEnd' }, { type: 'endTrackDrag' }],
            [{ kind: 'restart' }, { type: 'restart' }],
        ];
        for (const [gesture, expected] of cases) {
            expect(gestureToCommand(gesture)).toEqual(expected);
        }
    });
});

describe('cell lookup from a grid point', () => {
    const size = { width: 3, height: 3 };

    it('maps points inside each cell to row-major indices', () => {
        expect(cellAtGridPoint(size, 100, 10, 10)).toBe(0);
        expect(cellAtGridPoint(size, 100, 150, 10)).toBe(1);
        expect(cellAtGridPoint(size, 100, 250, 250)).toBe(8);
    });

    it('treats the boundary as belonging to the cell on its right or below', () => {
        expect(cellAtGridPoint(size, 100, 100, 0)).toBe(1);
        expect(cellAtGridPoint(size, 100, 0, 100)).toBe(3);
    });

    it('returns null outside the board or for a non-positive cell size', () => {
        expect(cellAtGridPoint(size, 100, -1, 10)).toBeNull();
        expect(cellAtGridPoint(size, 100, 300, 10)).toBeNull();
        expect(cellAtGridPoint(size, 0, 10, 10)).toBeNull();
    });
});
