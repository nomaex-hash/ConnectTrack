import { ProgressionSystem } from './ProgressionSystem';


export class ProgressionHolder {
    private static _current: ProgressionSystem | null = null;

    static get current(): ProgressionSystem | null {
        return this._current;
    }

    static set(progression: ProgressionSystem | null): void {
        this._current = progression;
    }
}
