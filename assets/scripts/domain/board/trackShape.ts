import { Direction, areOpposite, isDirection } from './direction';

export type TrackShape = 'straight' | 'curve';

/**
 * Shape of a Track from its two connection directions:
 * opposite directions form a straight Track, adjacent directions form a curve.
 */
export function trackShapeOf(first: Direction, second: Direction): TrackShape {
    if (!isDirection(first) || !isDirection(second)) {
        throw new RangeError('Track directions must be single direction bitmasks (1, 2, 4 or 8).');
    }
    if (first === second) {
        throw new RangeError('A Track needs two different connection directions.');
    }
    return areOpposite(first, second) ? 'straight' : 'curve';
}
