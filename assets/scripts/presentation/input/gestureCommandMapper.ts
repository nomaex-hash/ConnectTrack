import { GameCommand } from '../../application/commands/gameCommand';
import { BoardSize } from '../../domain/board/cellIndex';

/**
 * Semantic gestures produced by the Presentation input layer.
 * The input layer alone decides whether a touch was a tap or a double tap, and how drag
 * samples are batched. Those thresholds and sampling rules are UNKNOWN and are not defined here.
 */
export type PlayerGesture =
    | { readonly kind: 'tap'; readonly cell: number }
    | { readonly kind: 'doubleTap'; readonly cell: number }
    | { readonly kind: 'emptyDragBatch'; readonly cells: readonly number[] }
    | { readonly kind: 'xDragBatch'; readonly cells: readonly number[] }
    | { readonly kind: 'trackDragBegin'; readonly cell: number }
    | { readonly kind: 'trackBoundaryStep'; readonly from: number; readonly to: number }
    | { readonly kind: 'trackDragEnd' }
    | { readonly kind: 'restart' };

/** Maps one semantic gesture to one neutral Application command. No decisions beyond the mapping. */
export function gestureToCommand(gesture: PlayerGesture): GameCommand {
    switch (gesture.kind) {
        case 'tap':
            return { type: 'tapCell', cell: gesture.cell };
        case 'doubleTap':
            return { type: 'doubleTapCell', cell: gesture.cell };
        case 'emptyDragBatch':
            return { type: 'markCellsAsX', cells: gesture.cells };
        case 'xDragBatch':
            return { type: 'removeXCells', cells: gesture.cells };
        case 'trackDragBegin':
            return { type: 'beginTrackDrag', cell: gesture.cell };
        case 'trackBoundaryStep':
            return { type: 'trackBoundaryCrossed', from: gesture.from, to: gesture.to };
        case 'trackDragEnd':
            return { type: 'endTrackDrag' };
        case 'restart':
            return { type: 'restart' };
    }
}

/**
 * Converts a point in grid pixels (origin at the board's top-left, y grows downward) into a cell
 * index, or null when the point is off the board. Cell size is a layout value, not gameplay.
 */
export function cellAtGridPoint(size: BoardSize, cellSize: number, x: number, y: number): number | null {
    if (!(cellSize > 0) || x < 0 || y < 0) {
        return null;
    }
    const column = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (column >= size.width || row >= size.height) {
        return null;
    }
    return row * size.width + column;
}
