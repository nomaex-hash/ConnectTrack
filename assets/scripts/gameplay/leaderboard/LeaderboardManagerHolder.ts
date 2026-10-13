import { LeaderboardManager } from './LeaderboardManager';

export class LeaderboardManagerHolder {
    private static _current: LeaderboardManager | null = null;

    static get current(): LeaderboardManager | null {
        return this._current;
    }

    static set(system: LeaderboardManager | null): void {
        this._current = system;
    }
}
