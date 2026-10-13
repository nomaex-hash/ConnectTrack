import { ShopIAPManager } from './ShopIAPManager';

export class ShopIAPManagerHolder {
    private static _current: ShopIAPManager | null = null;

    static get current(): ShopIAPManager | null {
        return this._current;
    }

    static set(service: ShopIAPManager | null): void {
        this._current = service;
    }
}
