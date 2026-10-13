import { PuzzleSession } from './PuzzleSession';

export class PuzzleSessionHolder {
    private static _current: PuzzleSession | null = null;

    static get current(): PuzzleSession | null {
        return this._current;
    }

    static set(session: PuzzleSession | null): void {
        this._current = session;
    }
}
