import { describe, expect, it } from 'vitest';
import { ALL_DIRECTIONS, Direction, areOpposite, isDirection, oppositeOf } from '../../../assets/scripts/domain/board/direction';

describe('Direction bitmasks', () => {
    it('uses the confirmed values: Up 1, Right 2, Down 4, Left 8', () => {
        expect(Direction.Up).toBe(1);
        expect(Direction.Right).toBe(2);
        expect(Direction.Down).toBe(4);
        expect(Direction.Left).toBe(8);
    });

    it('lists all four directions once', () => {
        expect(ALL_DIRECTIONS).toEqual([1, 2, 4, 8]);
    });

    it('accepts only single confirmed bitmasks', () => {
        for (const value of [1, 2, 4, 8]) {
            expect(isDirection(value)).toBe(true);
        }
        for (const value of [0, 3, 5, 6, 9, 16, -1]) {
            expect(isDirection(value)).toBe(false);
        }
    });

    it('pairs opposite directions', () => {
        expect(oppositeOf(Direction.Up)).toBe(Direction.Down);
        expect(oppositeOf(Direction.Left)).toBe(Direction.Right);
        expect(areOpposite(Direction.Up, Direction.Down)).toBe(true);
        expect(areOpposite(Direction.Up, Direction.Right)).toBe(false);
    });
});
