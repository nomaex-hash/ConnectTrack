import { DailyPuzzleService } from './DailyPuzzleService';


export class DailyServiceHolder {
    private static _current: DailyPuzzleService | null = null;

    static get current(): DailyPuzzleService | null {
        return this._current;
    }

    static set(service: DailyPuzzleService | null): void {
        this._current = service;
    }
}
