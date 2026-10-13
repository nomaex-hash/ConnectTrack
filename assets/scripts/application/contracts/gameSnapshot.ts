import { PlayerCellState } from '../../domain/board/playerCellState';
import { Direction } from '../../domain/board/direction';

export enum GamePhase {
    Active = 'Active',
    Won = 'Won',
    Lost = 'Lost',
}

export interface TrackQuestion {
    readonly cell: number;
    /** Direction of the single connection that makes this a Track ? (partial connection). */
    readonly direction: Direction;
}

export interface MainTrackPorts {
    readonly cell: number;
    /** The Main Track's fixed connection directions at this cell (always 2). */
    readonly directions: readonly Direction[];
    /**
     * Which of the 2 directions leads off the board (level data's `a` at s[0], `b` at s[-1]), or
     * null for a given cell that isn't a board-edge endpoint — it has no outward port at all.
     */
    readonly outward: Direction | null;
}

/** Read-only view of the session for Presentation. Holds no Domain objects. */
export interface LineClue {
    readonly count: number;
    readonly required: number;
    readonly satisfied: boolean;
}

export interface GameSnapshot {
    readonly rowClues: readonly LineClue[];
    readonly columnClues: readonly LineClue[];
    readonly phase: GamePhase;
    readonly width: number;
    readonly height: number;
    /** Player state per cell, row-major (index = y * width + x). */
    readonly cellStates: readonly PlayerCellState[];
    /** Player connection directions per cell (excludes Main Track ports). */
    readonly cellLinks: readonly (readonly Direction[])[];
    /** Cells with exactly one connection. Track ? is not a PlayerCellState. */
    readonly trackQuestions: readonly TrackQuestion[];
    /** Fixed Main Track cells: level data's given (g) — always includes s[0]/s[-1], may include more. */
    readonly mainTrackCells: readonly number[];
    /** The Main Track's own fixed ports, for rendering its shape. Not mutable player state. */
    readonly mainTrackPorts: readonly MainTrackPorts[];
    /** s[0]: the cell the train enters the board at. */
    readonly entranceCell: number;
    /** s[-1]: the cell the train exits the board at. */
    readonly exitCell: number;
    /** Current drag pivot, or null when no Track drag is in progress. */
    readonly dragPivot: number | null;
    readonly mistakes: number;
    readonly maxMistakes: number;
    /**
     * True once every required cell has been identified as track (TrackPreview, Track ?, or a
     * completed Track) but is not yet fully connected into a Track everywhere — confirmed by the
     * user: show a hint telling the player to connect them, hide it once they finish (Won) or stop
     * being fully identified (e.g. a cell gets tapped back to Empty/X).
     */
    readonly needsConnectionHint: boolean;
}

export type RejectionReason =
    | 'gameFinished'
    | 'outOfBounds'
    | 'mainTrackCell'
    | 'notAllowedOnState'
    | 'redXLocked'
    | 'emptyBatch'
    | 'batchContainsIneligibleCell'
    | 'dragAlreadyActive'
    | 'noActiveDrag'
    | 'notPivot'
    | 'notAdjacent'
    | 'targetLocked'
    /** Place Track (confirmed by the user): every required cell is already correctly placed — there
     * is nothing left to auto-place. */
    | 'nothingToPlace'
    /** Revive (confirmed by the user): only meaningful when phase is Lost — rejected otherwise. */
    | 'notLost';

export type CommandResult =
    | { readonly accepted: true; readonly changed: boolean; readonly snapshot: GameSnapshot }
    | { readonly accepted: false; readonly reason: RejectionReason; readonly snapshot: GameSnapshot };
