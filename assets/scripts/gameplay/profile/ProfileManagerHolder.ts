import { ProfileManager } from './ProfileManager';

export class ProfileManagerHolder {
    private static _current: ProfileManager | null = null;

    static get current(): ProfileManager | null {
        return this._current;
    }

    static set(system: ProfileManager | null): void {
        this._current = system;
    }
}
