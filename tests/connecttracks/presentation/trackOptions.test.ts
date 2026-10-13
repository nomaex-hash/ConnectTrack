import { describe, expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { GameCommand } from '../../../assets/scripts/application/commands/gameCommand';
import { GameSnapshot } from '../../../assets/scripts/application/contracts/gameSnapshot';
import { computeTrackOptionValidity, directionsForOrientation } from '../../../assets/scripts/presentation/board/trackOptions';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { TEST_LEVEL, TEST_LEVEL_WITH_MIDDLE_GIVEN } from '../domain/fixtures';

/*
 * TEST_LEVEL (3x3). Solution path 0 -> 1 -> 2 -> 5 -> 8. Given: 0 (ports Left/Right), 8 (ports
 * Down/Up). TEST_LEVEL_WITH_MIDDLE_GIVEN additionally makes 2 given too (ports Left toward 1,
 * Down toward 5).
 */

function snapshotFor(level = TEST_LEVEL, required = [1, 2, 5], ...commands: GameCommand[]): GameSnapshot {
    const session = new GameSession({ level, requiredCells: required });
    for (const command of commands) {
        session.dispatch(command);
    }
    return session.snapshot();
}

describe('computeTrackOptionValidity (confirmed by the user)', () => {
    it('a fresh TrackPreview cell: off-board direction (Up) invalidates every orientation using it', () => {
        // Cell 1: Left -> given 0 (points back, forced), Right -> 2, Down -> 4, Up -> off board.
        const snapshot = snapshotFor(TEST_LEVEL, [1, 2, 5], { type: 'doubleTapCell', cell: 1 });
        const validity = computeTrackOptionValidity(snapshot, 1);
        expect(validity.straightVertical).toBe(false); // needs Up
        expect(validity.curveTopLeft).toBe(false); // needs Up
        expect(validity.curveTopRight).toBe(false); // needs Up
    });

    it('a given neighbour that points back FORCES that direction: only orientations including it are valid', () => {
        const snapshot = snapshotFor(TEST_LEVEL, [1, 2, 5], { type: 'doubleTapCell', cell: 1 });
        const validity = computeTrackOptionValidity(snapshot, 1);
        // Left (toward given 0, which points back via its Right port) is forced.
        expect(validity.straightHorizontal).toBe(true); // [Left, Right] includes forced Left
        expect(validity.curveBottomLeft).toBe(true); // [Down, Left] includes forced Left
        expect(validity.curveBottomRight).toBe(false); // [Down, Right] does NOT include forced Left
    });

    it('a bare TrackPreview (0 links): "track preview" is still valid, and reported as the current option', () => {
        const snapshot = snapshotFor(TEST_LEVEL, [1, 2, 5], { type: 'doubleTapCell', cell: 1 });
        const validity = computeTrackOptionValidity(snapshot, 1);
        expect(validity.trackPreview).toBe(true);
        expect(validity.current).toBe('trackPreview');
    });

    it('a given neighbour that does NOT point back: that direction is excluded, not forced', () => {
        // Cell 3 (TEST_LEVEL_WITH_MIDDLE_GIVEN): Up -> given 0, whose ports are [Left, Right] — does
        // NOT point back at 3 (Down). Left -> off board. Only Down/Right remain usable.
        const snapshot = snapshotFor(TEST_LEVEL_WITH_MIDDLE_GIVEN, [1, 5]);
        const validity = computeTrackOptionValidity(snapshot, 3);
        expect(validity.curveBottomRight).toBe(true); // [Down, Right], the only fully-open pair
        expect(validity.straightVertical).toBe(false); // needs Up, which given 0 doesn't offer
        expect(validity.straightHorizontal).toBe(false); // needs Left, off board
        expect(validity.curveTopLeft).toBe(false);
        expect(validity.curveTopRight).toBe(false);
        expect(validity.curveBottomLeft).toBe(false);
    });

    it('two given neighbours that BOTH point back force both directions: only the one matching orientation is valid', () => {
        // Cell 5 (TEST_LEVEL_WITH_MIDDLE_GIVEN): Up -> given 2 (points back via its Down port),
        // Down -> given 8 (points back via its Up port). Right is off board.
        const snapshot = snapshotFor(TEST_LEVEL_WITH_MIDDLE_GIVEN, [1, 5], { type: 'doubleTapCell', cell: 5 });
        const validity = computeTrackOptionValidity(snapshot, 5);
        expect(validity.straightVertical).toBe(true); // [Up, Down] — the only pair satisfying both forced directions
        expect(validity.curveTopLeft).toBe(false);
        expect(validity.curveBottomLeft).toBe(false);
        expect(validity.curveTopRight).toBe(false);
        expect(validity.curveBottomRight).toBe(false);
    });

    it('a completed Track: its own current orientation stays valid AND is reported as current (confirmed by the user)', () => {
        const snapshot = snapshotFor(
            TEST_LEVEL,
            [1, 2, 5],
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 0 },
            { type: 'trackBoundaryCrossed', from: 0, to: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
            { type: 'endTrackDrag' },
        );
        const validity = computeTrackOptionValidity(snapshot, 1);
        expect(validity.straightHorizontal).toBe(true); // still valid/tappable, not excluded
        expect(validity.current).toBe('straightHorizontal'); // this IS cell 1's current shape (Left+Right)
        expect(validity.trackPreview).toBe(true); // resetting is still a valid action too
    });

    it('a Track ? (1 link): no 2-direction shape matches it, so "track preview" is reported as current (confirmed by the user)', () => {
        const snapshot = snapshotFor(
            TEST_LEVEL,
            [1, 2, 5],
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 0 },
            { type: 'trackBoundaryCrossed', from: 0, to: 1 },
            { type: 'endTrackDrag' },
        );
        expect(computeTrackOptionValidity(snapshot, 1).current).toBe('trackPreview');
    });
});

describe('directionsForOrientation', () => {
    it('is the exact inverse of trackOrientationOf for every orientation', () => {
        expect(directionsForOrientation('straightHorizontal')).toEqual([Direction.Left, Direction.Right]);
        expect(directionsForOrientation('straightVertical')).toEqual([Direction.Up, Direction.Down]);
        expect(directionsForOrientation('curveTopLeft')).toEqual([Direction.Up, Direction.Left]);
        expect(directionsForOrientation('curveTopRight')).toEqual([Direction.Up, Direction.Right]);
        expect(directionsForOrientation('curveBottomLeft')).toEqual([Direction.Down, Direction.Left]);
        expect(directionsForOrientation('curveBottomRight')).toEqual([Direction.Down, Direction.Right]);
    });
});
