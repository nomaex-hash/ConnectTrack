import { IPGSPlayInstantManager } from './IPGSPlayInstantManager';
import { MockPGSPlayInstantManager } from './MockPGSPlayInstantManager';

export class PGSPlayInstantManagerHolder {
    private static _current: IPGSPlayInstantManager = new MockPGSPlayInstantManager();

    static get current(): IPGSPlayInstantManager {
        return this._current;
    }

    static set(client: IPGSPlayInstantManager): void {
        this._current = client;
    }
}
