import { Board } from '../board/board';
import { PlayerCellState } from '../board/playerCellState';
import { BoardSize, isIndexInBounds, neighborIndex } from '../board/cellIndex';
import { directionBetween } from '../board/adjacency';
import { Direction, oppositeOf } from '../board/direction';
import { SolutionTruth } from '../level/solutionTruth';

export type CrossingRejection = 'outOfBounds' | 'notAdjacent' | 'targetLocked';

export type CrossingResult =
    | { readonly kind: 'connected'; readonly board: Board }
    | { readonly kind: 'alreadyConnected'; readonly board: Board }
    | { readonly kind: 'wrongTarget'; readonly board: Board }
    | { readonly kind: 'rejected'; readonly reason: CrossingRejection };

/**
 * One cell-boundary crossing from `from` (the drag pivot) into the adjacent cell `to`.
 *
 * - Target not in Solution Truth: the target becomes RedX (kind `wrongTarget`). The caller counts the mistake.
 * - Target in Solution Truth: a connection is created from `from` toward `to` (kind `connected`).
 *   Solution membership comes only from SolutionTruth, never from the target's player state.
 * - The connection that already exists is reported as `alreadyConnected`, with no change.
 * - A crossing into X or RedX preserves the mark and creates no link/mistake.
 *   The caller keeps the current drag pivot, so the gesture can continue without lifting.
 * - A Main Track endpoint (or any given cell) target is a solution cell. The connection is recorded
 *   on the pivot only, because the Main Track's own port already points back.
 * - `from` being a given cell (Main Track) works the same way in reverse: it never has a mutable
 *   link of its own (its 2 ports are fixed from level start), so only `to` records the connection —
 *   confirmed by the user: dragging FROM a given cell works exactly like dragging from any other
 *   Track cell.
 * - Redirect (confirmed by the user), on EITHER end of the crossing: if a non-given cell already
 *   has 2 links (a completed Track) and a new valid connection reaches it, the OLDEST of its 2
 *   existing links is dropped to make room — along with that old neighbour's own reciprocal link,
 *   demoting it off Track if its degree drops below 2. This applies whether the full cell is
 *   `from` (the drag pivot redirecting itself) or `to` (the drag connecting into an already-
 *   completed neighbour): confirmed by the user — a cell that broke back down to Track ? (one
 *   link, from a redirect elsewhere) must support every action a fresh Track ? would, including
 *   connecting into a neighbour that already has a completed Track of its own.
 */
export function applyBoundaryCrossing(
    board: Board,
    truth: SolutionTruth,
    from: number,
    to: number,
): CrossingResult {
    const size = truth.level.size;
    if (!isIndexInBounds(size, from) || !isIndexInBounds(size, to)) {
        return { kind: 'rejected', reason: 'outOfBounds' };
    }
    const direction = directionBetween(size, from, to);
    if (direction === null) {
        return { kind: 'rejected', reason: 'notAdjacent' };
    }
    if (board.stateAt(to) === PlayerCellState.X || board.stateAt(to) === PlayerCellState.RedX) {
        return { kind: 'rejected', reason: 'targetLocked' };
    }
    if (!truth.isSolutionCell(to)) {
        return { kind: 'wrongTarget', board: board.withState(to, PlayerCellState.RedX) };
    }

    const fromIsMainTrack = board.mainTrack.portsAt(from).length > 0;
    const fromLinks = board.linksAt(from);
    if (fromLinks.includes(direction)) {
        return { kind: 'alreadyConnected', board };
    }

    const targetIsMainTrack = board.mainTrack.portsAt(to).length > 0;
    const reciprocal = oppositeOf(direction);

    let next = board;
    if (!fromIsMainTrack) {
        if (fromLinks.length >= 2) {
            next = redirectAwayFromOldestLink(next, from, size);
        }
        if (!next.linksAt(from).includes(direction)) {
            next = next.withLink(from, direction);
        }
    }
    if (!targetIsMainTrack) {
        if (!next.linksAt(to).includes(reciprocal) && next.linksAt(to).length >= 2) {
            next = redirectAwayFromOldestLink(next, to, size, reciprocal);
        }
        // Defensive: `to` can already hold this exact reciprocal direction (e.g. it was linked
        // from a different crossing that only touched `to`'s side, such as a given `from`) —
        // Board.withLink throws on a duplicate direction, so guard instead of assuming freshness.
        if (!next.linksAt(to).includes(reciprocal)) {
            next = next.withLink(to, reciprocal);
        }
    }
    return { kind: 'connected', board: next };
}

/**
 * Drops the OLDEST link of a cell that already has 2 (making room for a new connection) and
 * cleans up that old neighbour's own reciprocal link too, demoting it off Track if its degree
 * drops below 2 — the same redirect rule, usable on either end of a crossing (see module doc).
 * `keepDirection` (only relevant on the `to` side) skips a link that must survive this call, in the
 * rare case a cell already holds the exact reciprocal of the incoming connection.
 */
function redirectAwayFromOldestLink(board: Board, cell: number, size: BoardSize, keepDirection?: Direction): Board {
    const links = board.linksAt(cell);
    const oldDirection = links.find((candidate) => candidate !== keepDirection) ?? links[0];
    const oldNeighbor = neighborIndex(size, cell, oldDirection);
    let next = board.withoutLink(cell, oldDirection);
    if (oldNeighbor !== null && next.mainTrack.portsAt(oldNeighbor).length === 0) {
        const oldReciprocal = oppositeOf(oldDirection);
        if (next.linksAt(oldNeighbor).includes(oldReciprocal)) {
            next = next.withoutLink(oldNeighbor, oldReciprocal);
        }
    }
    return next;
}
