import { describe, expect, it } from 'vitest';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import {
    coordinateOf,
    indexOf,
    isIndexInBounds,
    neighborIndex,
} from '../../../assets/scripts/domain/board/cellIndex';

const SIZE = { width: 3, height: 2 };

describe('cell index (row-major, index = y * width + x)', () => {
    it('maps coordinates to indices row by row', () => {
        expect(indexOf(SIZE, { x: 0, y: 0 })).toBe(0);
        expect(indexOf(SIZE, { x: 2, y: 0 })).toBe(2);
        expect(indexOf(SIZE, { x: 0, y: 1 })).toBe(3);
        expect(indexOf(SIZE, { x: 2, y: 1 })).toBe(5);
    });

    it('round-trips index and coordinate', () => {
        for (let index = 0; index < 6; index++) {
            expect(indexOf(SIZE, coordinateOf(SIZE, index))).toBe(index);
        }
    });

    it('rejects indices and coordinates outside the w x h board', () => {
        expect(isIndexInBounds(SIZE, 5)).toBe(true);
        expect(isIndexInBounds(SIZE, 6)).toBe(false);
        expect(isIndexInBounds(SIZE, -1)).toBe(false);
        expect(isIndexInBounds(SIZE, 1.5)).toBe(false);
        expect(() => indexOf(SIZE, { x: 3, y: 0 })).toThrow(RangeError);
        expect(() => coordinateOf(SIZE, 6)).toThrow(RangeError);
    });
});

describe('neighbour lookup', () => {
    it('steps Up as y - 1 and Right as x + 1', () => {
        expect(neighborIndex(SIZE, 4, Direction.Up)).toBe(1);
        expect(neighborIndex(SIZE, 1, Direction.Right)).toBe(2);
        expect(neighborIndex(SIZE, 1, Direction.Down)).toBe(4);
        expect(neighborIndex(SIZE, 4, Direction.Left)).toBe(3);
    });

    it('returns null for a step that leaves the board (border outward)', () => {
        expect(neighborIndex(SIZE, 0, Direction.Up)).toBeNull();
        expect(neighborIndex(SIZE, 0, Direction.Left)).toBeNull();
        expect(neighborIndex(SIZE, 2, Direction.Right)).toBeNull();
        expect(neighborIndex(SIZE, 5, Direction.Down)).toBeNull();
    });
});
