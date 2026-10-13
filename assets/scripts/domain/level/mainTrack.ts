import { Direction } from '../board/direction';
import { directionBetween } from '../board/adjacency';
import { LevelData } from './levelData';

/**
 * Immutable Main Track derived from level data at level start: every cell in `level.given` is
 * locked and pre-filled (CONFIRMED-BY-USER), not just the two path endpoints.
 *
 *   start cell s[0]:               ports = [a, direction toward s[1]]
 *   end cell s[-1]:                ports = [b, direction toward s[-2]]
 *   any other given cell at s[i]:  ports = [direction toward s[i-1], direction toward s[i+1]]
 *
 * This mapping is the one the contract states. How the two ends pair up
 * beyond these ports is UNKNOWN (per-end bookkeeping), so this model only exposes ports.
 */
export interface MainTrack {
    portsAt(cell: number): readonly Direction[];
}

export function deriveMainTrack(level: LevelData): MainTrack {
    const path = level.solutionPath;
    const start = path[0];
    const end = path[path.length - 1];
    const towardSecond = directionBetween(level.size, start, path[1]);
    const towardSecondLast = directionBetween(level.size, end, path[path.length - 2]);
    if (towardSecond === null || towardSecondLast === null) {
        // Unreachable for a level created through createLevelData, which validates adjacency.
        throw new Error('Main Track derivation requires adjacent solution cells.');
    }

    const portsByCell = new Map<number, readonly Direction[]>([
        [start, Object.freeze([level.outwardStart, towardSecond])],
        [end, Object.freeze([level.outwardEnd, towardSecondLast])],
    ]);

    const pathIndexByCell = new Map<number, number>(path.map((cell, index) => [cell, index]));
    for (const cell of level.given) {
        if (cell === start || cell === end) {
            continue;
        }
        const index = pathIndexByCell.get(cell);
        if (index === undefined) {
            // Unreachable: createLevelData validates every given cell lies on the solution path.
            continue;
        }
        const towardPrev = directionBetween(level.size, cell, path[index - 1]);
        const towardNext = directionBetween(level.size, cell, path[index + 1]);
        if (towardPrev === null || towardNext === null) {
            throw new Error('Main Track derivation requires adjacent solution cells.');
        }
        portsByCell.set(cell, Object.freeze([towardPrev, towardNext]));
    }

    return {
        portsAt(cell: number): readonly Direction[] {
            return portsByCell.get(cell) ?? [];
        },
    };
}
