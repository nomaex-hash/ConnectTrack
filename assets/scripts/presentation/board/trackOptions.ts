import { ALL_DIRECTIONS, Direction, oppositeOf } from '../../domain/board/direction';
import { neighborIndex } from '../../domain/board/cellIndex';
import { GameSnapshot } from '../../application/contracts/gameSnapshot';
import { TrackOrientation, trackOrientationOf } from './trackOrientation';

/** Every option in the Track option menu (confirmed by the user): "track preview" (clears back to
 * 0 links) plus the 6 two-direction Track shapes. */
export type TrackOptionKind = 'trackPreview' | TrackOrientation;

/**
 * Which options in the Track option menu (confirmed by the user) are selectable for one cell. A
 * `false` value means the option renders as its DISABLED node cluster — still shown, never
 * tappable. `current` is the one option (if any) matching the cell's shape RIGHT NOW — it is
 * ALWAYS valid/tappable too, just additionally marked with a blue outline (its own node, on top of
 * the normal enabled cluster) so the player can see what's already there.
 */
export interface TrackOptionValidity {
    /** Resets the cell back to a bare TrackPreview (0 links). Always valid — there is no
     * geometric constraint on having no connections at all. */
    readonly trackPreview: boolean;
    readonly straightHorizontal: boolean;
    readonly straightVertical: boolean;
    readonly curveTopLeft: boolean;
    readonly curveTopRight: boolean;
    readonly curveBottomLeft: boolean;
    readonly curveBottomRight: boolean;
    readonly current: TrackOptionKind | null;
}

const ORIENTATION_DIRECTIONS: Readonly<Record<TrackOrientation, readonly [Direction, Direction]>> = {
    straightHorizontal: [Direction.Left, Direction.Right],
    straightVertical: [Direction.Up, Direction.Down],
    curveTopLeft: [Direction.Up, Direction.Left],
    curveTopRight: [Direction.Up, Direction.Right],
    curveBottomLeft: [Direction.Down, Direction.Left],
    curveBottomRight: [Direction.Down, Direction.Right],
};

/** The 2 connection directions a given TrackOrientation represents — the reverse of trackOrientationOf. */
export function directionsForOrientation(orientation: TrackOrientation): readonly [Direction, Direction] {
    return ORIENTATION_DIRECTIONS[orientation];
}

/**
 * Validity of every option in the Track option menu for one cell (confirmed by the user):
 *
 * - A direction that steps off the board is never valid — only the 2 Entrance/Exit cells lead off
 *   the board, never a player Track.
 * - A direction toward a neighbour that IS a given (Main Track) cell: valid only if that given's
 *   own fixed port actually points back (its `directions` includes the opposite direction) — a
 *   given's 2 ports are fixed from level start, so a player Track can only connect to it along a
 *   direction it is actually facing. When it DOES point back, that direction becomes FORCED: every
 *   orientation that doesn't include it is invalid too (the given's connection is mandatory, not
 *   optional).
 * - A direction toward any other (non-given) neighbour has no constraint here — whether it is
 *   actually correct is Solution Truth, which this menu deliberately does not reveal; picking a
 *   wrong one is simply applied as-is with no feedback at all (confirmed by the user — unlike a
 *   drag crossing, applying a shape never touches the neighbour, so there is no RedX/mistake to
 *   trigger; see GameSession.handleApplyTrackShape).
 * - The option matching the cell's CURRENT shape is always valid too (not excluded) — it is
 *   reported separately as `current`, so Presentation can give it a blue outline instead of hiding
 *   it (confirmed by the user).
 */
export function computeTrackOptionValidity(snapshot: GameSnapshot, cell: number): TrackOptionValidity {
    const size = { width: snapshot.width, height: snapshot.height };
    const directionOk = new Map<Direction, boolean>();
    const forced: Direction[] = [];
    for (const direction of ALL_DIRECTIONS) {
        const neighbor = neighborIndex(size, cell, direction);
        if (neighbor === null) {
            directionOk.set(direction, false);
            continue;
        }
        const givenPorts = snapshot.mainTrackPorts.find((entry) => entry.cell === neighbor);
        if (!givenPorts) {
            directionOk.set(direction, true);
            continue;
        }
        const pointsBack = givenPorts.directions.includes(oppositeOf(direction));
        directionOk.set(direction, pointsBack);
        if (pointsBack) {
            forced.push(direction);
        }
    }

    const orientationValid = (orientation: TrackOrientation): boolean => {
        const [a, b] = ORIENTATION_DIRECTIONS[orientation];
        if (!directionOk.get(a) || !directionOk.get(b)) {
            return false;
        }
        return forced.every((direction) => direction === a || direction === b);
    };

    const cellLinks = snapshot.cellLinks[cell] ?? [];
    // Track ? (1 link) has no matching 2-direction shape — confirmed by the user: its current
    // option is "track preview" too, same as a bare TrackPreview (0 links). Only a completed Track
    // (2 links) matches one of the 6 shapes.
    const current: TrackOptionKind | null =
        cellLinks.length <= 1 ? 'trackPreview' : trackOrientationOf(cellLinks);

    return Object.freeze({
        trackPreview: true,
        straightHorizontal: orientationValid('straightHorizontal'),
        straightVertical: orientationValid('straightVertical'),
        curveTopLeft: orientationValid('curveTopLeft'),
        curveTopRight: orientationValid('curveTopRight'),
        curveBottomLeft: orientationValid('curveBottomLeft'),
        curveBottomRight: orientationValid('curveBottomRight'),
        current,
    });
}
