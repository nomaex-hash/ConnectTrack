import { Direction } from '../../domain/board/direction';
import { PlayerCellState } from '../../domain/board/playerCellState';
import { GameSnapshot } from '../../application/contracts/gameSnapshot';

/**
 * Presentation view model: a read-only classification of a GameSnapshot for rendering.
 * Pure data, no Cocos. It makes no gameplay decisions: every value comes from the snapshot.
 */
export type CellVisual = 'empty' | 'x' | 'trackPreview' | 'track' | 'redX';
/** Which dedicated entrance/exit node this cell should use, or null (not a board-edge endpoint). */
export type EntranceRole = 'in' | 'out' | null;

export interface CellViewModel {
    readonly index: number;
    readonly visual: CellVisual;
    /** True only for the two true board-edge endpoints (s[0]/s[-1]), not every given/Main Track cell. */
    readonly isMainTrackEndpoint: boolean;
    /** This cell's own player connection directions (0, 1 for Track ?, or 2 for a completed Track). */
    readonly trackDirections: readonly Direction[];
    /** Direction of the single connection that makes this cell a Track ?, or null. */
    readonly trackQuestionDirection: Direction | null;
    /** The Main Track's fixed ports at this cell, for rendering its shape. Empty unless isMainTrackEndpoint. */
    readonly mainPortDirections: readonly Direction[];
    /**
     * Which dedicated node (entrance "in" at s[0], exit "out" at s[-1]) this cell should show, or
     * null for every other cell — ConnectTracksCellView has 2 separate nodes, not one shared/rotated
     * node (confirmed by the user).
     */
    readonly entranceRole: EntranceRole;
    /**
     * The Main Track's outward (off-board) port at this cell, or null. This is the PHYSICAL edge
     * the cell sits on — used only to POSITION the entrance/exit node toward the board's border.
     * Rotation is NOT computed here: the entranceIn/entranceOut nodes are authored in the Editor
     * already pointing the correct way (confirmed by the user) — Presentation only places them.
     */
    readonly entranceDirection: Direction | null;
    readonly isDragPivot: boolean;
    /** RedX cells cannot be interacted with until Restart. */
    readonly isLocked: boolean;
    /**
     * True for the ONE cell (if any) whose Track option menu is currently open (confirmed by the
     * user: single-tapping a TrackPreview/Track/Track ? cell shows a blue outline on it + a fixed
     * options cluster elsewhere in Gameplay). Selection is Interaction State owned by
     * ConnectTracksBoardView, not Domain/GameSnapshot — passed in separately, like dragPivot.
     */
    readonly isOptionMenuSelected: boolean;
}

export interface BoardViewModel {
    readonly width: number;
    readonly height: number;
    readonly cells: readonly CellViewModel[];
}

export function classifyCellVisual(state: PlayerCellState): CellVisual {
    switch (state) {
        case PlayerCellState.Empty:
            return 'empty';
        case PlayerCellState.X:
            return 'x';
        case PlayerCellState.TrackPreview:
            return 'trackPreview';
        case PlayerCellState.Track:
            return 'track';
        case PlayerCellState.RedX:
            return 'redX';
    }
}

export function buildBoardViewModel(snapshot: GameSnapshot, optionMenuSelectedCell: number | null = null): BoardViewModel {
    const cells: CellViewModel[] = snapshot.cellStates.map((state, index) => {
        const question = snapshot.trackQuestions.find((entry) => entry.cell === index);
        const mainPorts = snapshot.mainTrackPorts.find((entry) => entry.cell === index);
        // `outward` is non-null only at the two true board-edge endpoints (entranceCell/exitCell —
        // every other given cell has none).
        const entranceRole: EntranceRole =
            index === snapshot.entranceCell ? 'in' : index === snapshot.exitCell ? 'out' : null;
        return Object.freeze({
            index,
            visual: classifyCellVisual(state),
            isMainTrackEndpoint: index === snapshot.entranceCell || index === snapshot.exitCell,
            trackDirections: snapshot.cellLinks[index],
            trackQuestionDirection: question ? question.direction : null,
            mainPortDirections: mainPorts ? mainPorts.directions : [],
            entranceRole,
            entranceDirection: mainPorts ? mainPorts.outward : null,
            isDragPivot: snapshot.dragPivot === index,
            isLocked: state === PlayerCellState.RedX,
            isOptionMenuSelected: optionMenuSelectedCell === index,
        });
    });
    return Object.freeze({
        width: snapshot.width,
        height: snapshot.height,
        cells: Object.freeze(cells),
    });
}
