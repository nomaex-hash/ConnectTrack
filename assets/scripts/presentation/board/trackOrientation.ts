import { Direction } from '../../domain/board/direction';

/**
 * Visual orientation of a two-direction Track (or Main Track) piece, derived purely from its
 * connection directions. A presentation-only concern: opposite directions are a straight piece,
 * adjacent directions are a curve piece in one of the four corners.
 */
export type TrackOrientation =
    | 'straightHorizontal'
    | 'straightVertical'
    | 'curveTopLeft'
    | 'curveTopRight'
    | 'curveBottomLeft'
    | 'curveBottomRight';

export function trackOrientationOf(directions: readonly Direction[]): TrackOrientation | null {
    if (directions.length !== 2) {
        return null;
    }
    const has = (direction: Direction): boolean => directions.indexOf(direction) !== -1;
    if (has(Direction.Up) && has(Direction.Down)) {
        return 'straightVertical';
    }
    if (has(Direction.Left) && has(Direction.Right)) {
        return 'straightHorizontal';
    }
    if (has(Direction.Up) && has(Direction.Left)) {
        return 'curveTopLeft';
    }
    if (has(Direction.Up) && has(Direction.Right)) {
        return 'curveTopRight';
    }
    if (has(Direction.Down) && has(Direction.Left)) {
        return 'curveBottomLeft';
    }
    if (has(Direction.Down) && has(Direction.Right)) {
        return 'curveBottomRight';
    }
    return null; // Two equal directions: not a valid pair (defensive only; Domain already rejects this).
}
