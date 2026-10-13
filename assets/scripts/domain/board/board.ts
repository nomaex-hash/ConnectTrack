import { Direction, isDirection } from './direction';
import { BoardSize, cellCount, isIndexInBounds, neighborIndex } from './cellIndex';
import { PlayerCellState } from './playerCellState';
import { MainTrack } from '../level/mainTrack';

/**
 * Immutable player board. Every change returns a new Board.
 *
 * Two things are stored per cell, separately:
 *   - player state (PlayerCellState), and
 *   - connection links: directions along which this cell has a player connection.
 * A link is a connection as soon as it is created; it does not need the neighbour to point back.
 * A cell with two links is in the Track state. A cell with one link is Track ? (derived by the
 * caller, not a PlayerCellState).
 *
 * The Main Track is a fixed reference and is never part of the mutable records, so Restart keeps it.
 *
 * Not modelled here (UNKNOWN or Interaction State, see the gameplay contract):
 * drag state, gesture timing, batch X timing, the effect on neighbours of Track -> TrackPreview.
 */
export class Board {
    private constructor(
        readonly size: BoardSize,
        readonly mainTrack: MainTrack,
        private readonly states: readonly PlayerCellState[],
        private readonly links: ReadonlyMap<number, readonly Direction[]>,
    ) {}

    static empty(size: BoardSize, mainTrack: MainTrack): Board {
        if (!Number.isInteger(size.width) || size.width < 1 || !Number.isInteger(size.height) || size.height < 1) {
            throw new RangeError('Board width and height must be positive integers.');
        }
        return new Board(
            size,
            mainTrack,
            new Array<PlayerCellState>(cellCount(size)).fill(PlayerCellState.Empty),
            new Map(),
        );
    }

    stateAt(index: number): PlayerCellState {
        this.assertInBounds(index);
        return this.states[index];
    }

    /** Player connection directions of a cell (not including Main Track ports). */
    linksAt(index: number): readonly Direction[] {
        this.assertInBounds(index);
        return this.links.get(index) ?? [];
    }

    /**
     * Sets a non-Track state. Clears this cell's own links.
     * A RedX cell is locked until Restart, so any change to it throws.
     */
    withState(index: number, state: PlayerCellState): Board {
        this.assertInBounds(index);
        if (state === PlayerCellState.Track) {
            throw new RangeError('A Track is derived from two links; use withLink or withTrack.');
        }
        this.assertNotLocked(index);
        const nextStates = this.states.slice();
        nextStates[index] = state;
        const nextLinks = new Map(this.links);
        nextLinks.delete(index);
        return new Board(this.size, this.mainTrack, nextStates, nextLinks);
    }

    /**
     * Adds one directional connection from this cell. Reaching two links puts the cell in the Track state.
     * Rejects: a Main Track endpoint, a RedX cell, a direction that leaves the board, a duplicate
     * link, and any third link (degree <= 2).
     */
    withLink(index: number, direction: Direction): Board {
        this.assertInBounds(index);
        if (!isDirection(direction)) {
            throw new RangeError('A link direction must be a single direction bitmask (1, 2, 4 or 8).');
        }
        if (this.mainTrack.portsAt(index).length > 0) {
            throw new RangeError(`Cell ${index} is a fixed Main Track cell; a Player Track cannot occupy it.`);
        }
        this.assertNotLocked(index);
        if (neighborIndex(this.size, index, direction) === null) {
            throw new RangeError('A connection cannot point outward past the board border.');
        }
        const current = this.linksAt(index);
        if (current.includes(direction)) {
            throw new RangeError(`Cell ${index} already has a link ${direction}.`);
        }
        if (current.length >= 2) {
            throw new RangeError('Track degree cannot exceed 2.');
        }
        const nextLinks = new Map(this.links);
        const next = Object.freeze([...current, direction]);
        nextLinks.set(index, next);
        const nextStates = this.states.slice();
        if (next.length === 2) {
            nextStates[index] = PlayerCellState.Track;
        }
        return new Board(this.size, this.mainTrack, nextStates, nextLinks);
    }

    /** Places a Track with two connection directions on this cell only. */
    withTrack(index: number, first: Direction, second: Direction): Board {
        if (first === second) {
            throw new RangeError('A Track needs two different connection directions.');
        }
        return this.withLink(index, first).withLink(index, second);
    }

    /**
     * Removes one existing connection from this cell (the opposite of withLink). Used to redirect
     * a completed Track toward a new direction (confirmed by the user): dropping one of its 2 links
     * makes room before the new one is added. If this drops the cell's degree below 2, its own
     * PlayerCellState is demoted off Track to TrackPreview — Track implies exactly 2 links, the same
     * invariant a double-tap's Track -> TrackPreview transition already enforces.
     */
    withoutLink(index: number, direction: Direction): Board {
        this.assertInBounds(index);
        this.assertNotLocked(index);
        const current = this.linksAt(index);
        if (!current.includes(direction)) {
            throw new RangeError(`Cell ${index} has no link ${direction} to remove.`);
        }
        const next = Object.freeze(current.filter((existing) => existing !== direction));
        const nextLinks = new Map(this.links);
        if (next.length === 0) {
            nextLinks.delete(index);
        } else {
            nextLinks.set(index, next);
        }
        const nextStates = this.states.slice();
        if (next.length < 2 && this.states[index] === PlayerCellState.Track) {
            nextStates[index] = PlayerCellState.TrackPreview;
        }
        return new Board(this.size, this.mainTrack, nextStates, nextLinks);
    }

    /** Restart: clears player actions, links and RedX locks, keeps the Main Track. */
    restarted(): Board {
        return Board.empty(this.size, this.mainTrack);
    }

    private assertNotLocked(index: number): void {
        if (this.states[index] === PlayerCellState.RedX) {
            throw new Error(`Cell ${index} is RedX and locked until Restart.`);
        }
    }

    private assertInBounds(index: number): void {
        if (!isIndexInBounds(this.size, index)) {
            throw new RangeError(`Cell index ${index} is outside the board.`);
        }
    }
}
