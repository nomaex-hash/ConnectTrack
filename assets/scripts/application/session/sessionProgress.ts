import { Board } from '../../domain/board/board';
import { PlayerCellState } from '../../domain/board/playerCellState';
import { isDirection } from '../../domain/board/direction';
import { SolutionTruth } from '../../domain/level/solutionTruth';
import { MAX_MISTAKES, MistakeCounter } from '../../domain/rules/mistakeCounter';

export interface SessionProgress {
    readonly version: 1;
    readonly levelSignature: string;
    readonly states: readonly PlayerCellState[];
    readonly links: readonly (readonly number[])[];
    readonly mistakes: number;
}

export function levelSignature(truth: SolutionTruth, required: readonly number[]): string {
    const l = truth.level;
    return JSON.stringify([l.size.width, l.size.height, l.solutionPath, l.given.slice().sort((a,b) => a-b),
        l.outwardStart, l.outwardEnd, required.slice().sort((a,b) => a-b)]);
}

/** Validate into a new immutable board before replacing any live session state. */
export function readSessionProgress(raw: unknown, truth: SolutionTruth, required: readonly number[]):
    { board: Board; mistakes: MistakeCounter } | null {
    if (!raw || typeof raw !== 'object') return null;
    const p = raw as Partial<SessionProgress>;
    const count = truth.level.size.width * truth.level.size.height;
    if (p.version !== 1 || p.levelSignature !== levelSignature(truth, required)
        || !Array.isArray(p.states) || p.states.length !== count
        || !Array.isArray(p.links) || p.links.length !== count
        || !Number.isInteger(p.mistakes) || p.mistakes! < 0 || p.mistakes! >= MAX_MISTAKES) return null;
    let board = Board.empty(truth.level.size, truth.mainTrack);
    let redCount = 0;
    try {
        for (let cell = 0; cell < count; cell++) {
            const state = p.states[cell];
            const links = p.links[cell];
            if (!Object.values(PlayerCellState).includes(state) || !Array.isArray(links)
                || links.length > 2 || !links.every(isDirection)) return null;
            if (truth.mainTrack.portsAt(cell).length > 0) {
                if (state !== PlayerCellState.Empty || links.length) return null;
                continue;
            }
            if ((state === PlayerCellState.Track || state === PlayerCellState.TrackPreview || links.length > 0)
                && !truth.isSolutionCell(cell)) return null;
            if ((state === PlayerCellState.X || state === PlayerCellState.RedX) && links.length) return null;
            if (state === PlayerCellState.RedX) redCount++;
            board = board.withState(cell, state === PlayerCellState.Track ? PlayerCellState.TrackPreview : state);
            for (const direction of links) board = board.withLink(cell, direction);
            if (board.stateAt(cell) !== state) return null;
        }
    } catch { return null; }
    if (redCount !== p.mistakes) return null;
    let mistakes = MistakeCounter.initial();
    for (let i = 0; i < p.mistakes!; i++) mistakes = mistakes.recordMistake();
    return { board, mistakes };
}
