import { Direction } from '../board/direction';
import { directionBetween } from '../board/adjacency';
import { LevelData } from './levelData';
import { MainTrack, deriveMainTrack } from './mainTrack';

/**
 * Level Solution Truth: the immutable answer for a level.
 * Membership depends only on level data, never on player state.
 */
export interface SolutionTruth {
    readonly level: LevelData;
    readonly mainTrack: MainTrack;
    isSolutionCell(cell: number): boolean;
    /**
     * The exact 2 connection directions a fully correct Track at this solution-path cell must
     * have — works for ANY solution-path cell, given or required (unlike MainTrack.portsAt, which
     * is empty for a non-given cell). Null when `cell` is not on the solution path at all.
     */
    correctDirectionsAt(cell: number): readonly [Direction, Direction] | null;
}

export function createSolutionTruth(level: LevelData): SolutionTruth {
    const path = level.solutionPath;
    const solutionCells = new Set<number>(path);
    const pathIndexByCell = new Map<number, number>(path.map((cell, index) => [cell, index]));
    const mainTrack = deriveMainTrack(level);

    return {
        level,
        mainTrack,
        isSolutionCell(cell: number): boolean {
            return solutionCells.has(cell);
        },
        correctDirectionsAt(cell: number): readonly [Direction, Direction] | null {
            // Every given cell (both path endpoints, and any extra pre-filled middle cell) already
            // has its correct ports derived by deriveMainTrack — reuse it instead of recomputing.
            const givenPorts = mainTrack.portsAt(cell);
            if (givenPorts.length === 2) {
                return givenPorts as readonly [Direction, Direction];
            }
            // An ordinary (non-given) required cell in the middle of the path: same
            // toward-previous/toward-next formula deriveMainTrack uses for a middle given cell.
            const index = pathIndexByCell.get(cell);
            if (index === undefined || index === 0 || index === path.length - 1) {
                return null; // Not on the path, or an endpoint (always given, already handled above).
            }
            const towardPrev = directionBetween(level.size, cell, path[index - 1]);
            const towardNext = directionBetween(level.size, cell, path[index + 1]);
            if (towardPrev === null || towardNext === null) {
                return null; // Unreachable for a level built through createLevelData.
            }
            return [towardPrev, towardNext];
        },
    };
}
