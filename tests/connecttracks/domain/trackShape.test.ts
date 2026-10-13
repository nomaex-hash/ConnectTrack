import { describe, expect, it } from 'vitest';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { trackShapeOf } from '../../../assets/scripts/domain/board/trackShape';

describe('Track shape from connection directions', () => {
    it('opposite directions form a straight Track', () => {
        expect(trackShapeOf(Direction.Up, Direction.Down)).toBe('straight');
        expect(trackShapeOf(Direction.Left, Direction.Right)).toBe('straight');
    });

    it('adjacent directions form a curve', () => {
        expect(trackShapeOf(Direction.Up, Direction.Right)).toBe('curve');
        expect(trackShapeOf(Direction.Down, Direction.Left)).toBe('curve');
    });

    it('rejects a Track with the same direction twice', () => {
        expect(() => trackShapeOf(Direction.Up, Direction.Up)).toThrow(RangeError);
    });
});
