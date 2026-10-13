import { describe, expect, it } from 'vitest';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { PlayerCellState } from '../../../assets/scripts/domain/board/playerCellState';
import { applyBoundaryCrossing } from '../../../assets/scripts/domain/rules/boundaryCrossing';
import { emptyBoard, truthForTestLevel } from './fixtures';

/*
 * Test level (3x3). Solution path 0 -> 1 -> 2 -> 5 -> 8. Main Track endpoints: 0 and 8.
 * Non-solution cells: 3, 4, 6, 7.
 */

describe('applyBoundaryCrossing', () => {
    it('a crossing into a solution cell connects, on both ends', () => {
        const result = applyBoundaryCrossing(emptyBoard(), truthForTestLevel(), 1, 2);
        expect(result.kind).toBe('connected');
        if (result.kind !== 'connected') return;
        expect(result.board.linksAt(1)).toEqual([Direction.Right]);
        expect(result.board.linksAt(2)).toEqual([Direction.Left]);
    });

    it('a crossing along a link that already exists changes nothing', () => {
        const board = emptyBoard().withLink(1, Direction.Right);
        const result = applyBoundaryCrossing(board, truthForTestLevel(), 1, 2);
        expect(result.kind).toBe('alreadyConnected');
        if (result.kind !== 'alreadyConnected') return;
        expect(result.board).toBe(board);
    });

    it('a crossing into a non-solution cell makes it RedX, and creates no link', () => {
        const board = emptyBoard();
        const result = applyBoundaryCrossing(board, truthForTestLevel(), 1, 4);
        expect(result.kind).toBe('wrongTarget');
        if (result.kind !== 'wrongTarget') return;
        expect(result.board.stateAt(4)).toBe(PlayerCellState.RedX);
        expect(result.board.linksAt(1)).toEqual([]);
        // The input board is untouched.
        expect(board.stateAt(4)).toBe(PlayerCellState.Empty);
    });

    it('a cell index outside the board is rejected as outOfBounds, from either side', () => {
        const truth = truthForTestLevel();
        expect(applyBoundaryCrossing(emptyBoard(), truth, 9, 2)).toEqual({ kind: 'rejected', reason: 'outOfBounds' });
        expect(applyBoundaryCrossing(emptyBoard(), truth, 1, 9)).toEqual({ kind: 'rejected', reason: 'outOfBounds' });
    });

    it('a step that is not one cardinal move is rejected as notAdjacent, including diagonals', () => {
        const truth = truthForTestLevel();
        expect(applyBoundaryCrossing(emptyBoard(), truth, 0, 4)).toEqual({ kind: 'rejected', reason: 'notAdjacent' });
        expect(applyBoundaryCrossing(emptyBoard(), truth, 1, 1)).toEqual({ kind: 'rejected', reason: 'notAdjacent' });
    });

    it('a step that would wrap past the row end is rejected as notAdjacent (border outward)', () => {
        // Cell 2 is the right edge of row 0. Index 3 is the start of row 1, not a cardinal neighbour.
        expect(applyBoundaryCrossing(emptyBoard(), truthForTestLevel(), 2, 3)).toEqual({
            kind: 'rejected',
            reason: 'notAdjacent',
        });
    });

    it('a crossing into a Main Track endpoint connects on the pivot only (approved T4 behaviour)', () => {
        // Requested case: "rejected". The approved T4 rule says a Player Track connecting to the
        // Main Track counts as a connection. Production follows the approved rule; see the report.
        const result = applyBoundaryCrossing(emptyBoard(), truthForTestLevel(), 1, 0);
        expect(result.kind).toBe('connected');
        if (result.kind !== 'connected') return;
        expect(result.board.linksAt(1)).toEqual([Direction.Left]);
        expect(result.board.linksAt(0)).toEqual([]);
        expect(result.board.stateAt(0)).toBe(PlayerCellState.Empty);
    });

    it('a crossing into a RedX cell is rejected as targetLocked, and creates no mistake here', () => {
        const board = emptyBoard().withState(4, PlayerCellState.RedX);
        expect(applyBoundaryCrossing(board, truthForTestLevel(), 1, 4)).toEqual({
            kind: 'rejected',
            reason: 'targetLocked',
        });
    });

    it('a pivot that already has two links redirects instead of rejecting (confirmed by the user)', () => {
        // Cell 5 links Up (to 2) and Left (to 4, non-solution). Its solution neighbour 8 is unlinked.
        const board = emptyBoard().withLink(5, Direction.Up).withLink(5, Direction.Left);
        const result = applyBoundaryCrossing(board, truthForTestLevel(), 5, 8);
        expect(result.kind).toBe('connected');
        if (result.kind !== 'connected') return;
        // Oldest link (Up, added first) is dropped; Left (added second) stays; Down (new) is added.
        expect([...result.board.linksAt(5)]).toEqual([Direction.Left, Direction.Down]);
        expect(result.board.stateAt(5)).toBe(PlayerCellState.Track);
    });

    it('redirect also drops the OLD neighbour\'s reciprocal link, demoting it off Track if its own degree drops below 2', () => {
        const truth = truthForTestLevel();
        // 1 links Right toward 2 (with 2's own reciprocal Left, as a real crossing would leave it)
        // and Down toward 4. Its solution neighbour 0 (Main Track) is unlinked.
        const board = emptyBoard().withLink(1, Direction.Right).withLink(2, Direction.Left).withLink(1, Direction.Down);
        const result = applyBoundaryCrossing(board, truth, 1, 0); // Redirect: drag 1 toward Left (Main Track 0).
        expect(result.kind).toBe('connected');
        if (result.kind !== 'connected') return;
        // Oldest link (Right, toward 2) is dropped; Down stays; Left (new, toward Main Track) is added.
        expect([...result.board.linksAt(1)]).toEqual([Direction.Down, Direction.Left]);
        // Cell 2's reciprocal link back toward 1 is cleaned up too, demoting it off Track.
        expect([...result.board.linksAt(2)]).toEqual([]);
        expect(result.board.stateAt(2)).toBe(PlayerCellState.Empty);
    });

    it('a target that already has two links redirects too, instead of rejecting (confirmed by the user)', () => {
        const truth = truthForTestLevel();
        // Cell 1 is full: Right (to 2, oldest) and Down (to 4) — neither toward the pivot. Pivot 0
        // (Main Track) drags Right into 1.
        const board = emptyBoard().withLink(1, Direction.Right).withLink(1, Direction.Down);
        const result = applyBoundaryCrossing(board, truth, 0, 1);
        expect(result.kind).toBe('connected');
        if (result.kind !== 'connected') return;
        // Oldest link (Right, toward 2) is dropped; Down stays; Left (the new crossing, toward 0) is added.
        expect([...result.board.linksAt(1)]).toEqual([Direction.Down, Direction.Left]);
        expect(result.board.stateAt(1)).toBe(PlayerCellState.Track);
        // Pivot 0 is given: it never records its own link.
        expect(result.board.linksAt(0)).toEqual([]);
    });

    it('redirecting the TARGET also cleans up ITS old neighbour, same as redirecting the pivot', () => {
        const truth = truthForTestLevel();
        // Cell 5 is full: Up (to 2, oldest) and Left (to 4, non-solution) — its reciprocal on 2 is
        // set, as a real crossing would leave it. Pivot 8 (Main Track) drags Up into 5.
        const board = emptyBoard().withLink(5, Direction.Up).withLink(2, Direction.Down).withLink(5, Direction.Left);
        const result = applyBoundaryCrossing(board, truth, 8, 5);
        expect(result.kind).toBe('connected');
        if (result.kind !== 'connected') return;
        // 5's oldest link (Up, toward 2) is dropped; Left stays; Down (new, toward 8) is added.
        expect([...result.board.linksAt(5)]).toEqual([Direction.Left, Direction.Down]);
        // 2's reciprocal link back toward 5 is cleaned up too, demoting it off Track.
        expect([...result.board.linksAt(2)]).toEqual([]);
        expect(result.board.stateAt(2)).toBe(PlayerCellState.Empty);
    });

    it('a Track that broke back down to Track ? can still reconnect into an already-full neighbour (confirmed by the user)', () => {
        // This is exactly the scenario the user reported: cell 2 was a completed Track (Left to 1,
        // Down to 5) until a redirect elsewhere on cell 1 dropped cell 2's reciprocal, demoting it
        // to Track ? (one link, Down to 5). Cell 1 is now full with 2 OTHER links of its own. Cell
        // 2 (Track ?) must still be able to drag back toward 1 — 1 redirects too, same as any fresh
        // Track ? reconnecting into a completed neighbour.
        const truth = truthForTestLevel();
        const fullTrack = emptyBoard()
            .withLink(1, Direction.Right)
            .withLink(2, Direction.Left)
            .withLink(2, Direction.Down)
            .withLink(1, Direction.Down);
        const broken = applyBoundaryCrossing(fullTrack, truth, 1, 0); // Redirects 1 away from 2, demotes 2 to Track ?.
        expect(broken.kind).toBe('connected');
        if (broken.kind !== 'connected') return;
        expect([...broken.board.linksAt(2)]).toEqual([Direction.Down]);
        expect(broken.board.stateAt(2)).toBe(PlayerCellState.TrackPreview);
        expect([...broken.board.linksAt(1)]).toEqual([Direction.Down, Direction.Left]);

        const reconnected = applyBoundaryCrossing(broken.board, truth, 2, 1);
        expect(reconnected.kind).toBe('connected');
        if (reconnected.kind !== 'connected') return;
        expect([...reconnected.board.linksAt(2)]).toEqual([Direction.Down, Direction.Left]);
        expect(reconnected.board.stateAt(2)).toBe(PlayerCellState.Track);
        // 1's oldest remaining link (Down, toward 4) is redirected away to make room for 2.
        expect([...reconnected.board.linksAt(1)]).toEqual([Direction.Left, Direction.Right]);
    });

    it('a repeated crossing from a given (Main Track) pivot into the same target does not throw (regression)', () => {
        // Bug: a given `from` never records its own link (linksAt is always []), so the
        // `alreadyConnected` guard never caught a REPEAT of the same crossing — it tried to add the
        // reciprocal link on `to` a second time and Board.withLink threw "already has a link".
        const truth = truthForTestLevel();
        const first = applyBoundaryCrossing(emptyBoard(), truth, 0, 1);
        expect(first.kind).toBe('connected');
        if (first.kind !== 'connected') return;
        expect(() => applyBoundaryCrossing(first.board, truth, 0, 1)).not.toThrow();
        // from=0 is given, so it never records its own link — the repeat crossing is still
        // reported as 'connected' (not 'alreadyConnected', which only checks the pivot's own side),
        // but it changes nothing: the reciprocal on 1 is already there and is not duplicated.
        const second = applyBoundaryCrossing(first.board, truth, 0, 1);
        expect(second.kind).toBe('connected');
        if (second.kind !== 'connected') return;
        expect([...second.board.linksAt(1)]).toEqual([Direction.Left]);
    });

    it('drags FROM a given cell (Main Track) exactly like from any other Track cell (confirmed by the user)', () => {
        // Cell 0 is a Main Track endpoint (given). It never gets its own mutable link — only the
        // target (cell 1) records the connection, same as any other Main Track crossing.
        const result = applyBoundaryCrossing(emptyBoard(), truthForTestLevel(), 0, 1);
        expect(result.kind).toBe('connected');
        if (result.kind !== 'connected') return;
        expect(result.board.linksAt(0)).toEqual([]);
        expect([...result.board.linksAt(1)]).toEqual([Direction.Left]);
    });
});
