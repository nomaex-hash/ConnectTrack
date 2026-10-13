import { describe, expect, it } from 'vitest';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { trackOrientationOf } from '../../../assets/scripts/presentation/board/trackOrientation';

describe('trackOrientationOf', () => {
    it('opposite directions are straight pieces', () => {
        expect(trackOrientationOf([Direction.Up, Direction.Down])).toBe('straightVertical');
        expect(trackOrientationOf([Direction.Down, Direction.Up])).toBe('straightVertical');
        expect(trackOrientationOf([Direction.Left, Direction.Right])).toBe('straightHorizontal');
    });

    it('adjacent directions are curve pieces, one per corner', () => {
        expect(trackOrientationOf([Direction.Up, Direction.Left])).toBe('curveTopLeft');
        expect(trackOrientationOf([Direction.Up, Direction.Right])).toBe('curveTopRight');
        expect(trackOrientationOf([Direction.Down, Direction.Left])).toBe('curveBottomLeft');
        expect(trackOrientationOf([Direction.Down, Direction.Right])).toBe('curveBottomRight');
    });

    it('returns null for anything other than exactly two directions', () => {
        expect(trackOrientationOf([])).toBeNull();
        expect(trackOrientationOf([Direction.Up])).toBeNull();
    });
});
