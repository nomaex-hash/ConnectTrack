import { BoardSize, coordinateOf, indexOf } from '../../domain/board/cellIndex';

/**
 * Ordered, cardinally-adjacent cells from (exclusive) `fromCell` to (inclusive) `toCell`.
 *
 * Consecutive pointer-move samples are usually already adjacent, in which case this returns a
 * single-cell path. A fast swipe can skip cells between two samples; when that happens this
 * reconstructs a best-effort straight path (all column steps toward the target, then all row
 * steps) so the caller can still report one command per crossed boundary, in order. Which cells a
 * real finger crossed in that case is unknown; this is an implementation approximation for
 * reconstructing a plausible path, not a gameplay rule.
 */
export function cellPathBetween(size: BoardSize, fromCell: number, toCell: number): readonly number[] {
    if (fromCell === toCell) {
        return [];
    }
    const target = coordinateOf(size, toCell);
    let { x, y } = coordinateOf(size, fromCell);
    const path: number[] = [];
    while (x !== target.x) {
        x += x < target.x ? 1 : -1;
        path.push(indexOf(size, { x, y }));
    }
    while (y !== target.y) {
        y += y < target.y ? 1 : -1;
        path.push(indexOf(size, { x, y }));
    }
    return path;
}
