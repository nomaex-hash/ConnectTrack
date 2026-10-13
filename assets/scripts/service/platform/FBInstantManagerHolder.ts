import { IFBInstantManager } from './IFBInstantManager';
import { MockFBInstantManager } from './MockFBInstantManager';

/**
 * Định vị dịch vụ nền tảng hiện hành. Mặc định là MockFBInstantManager để chạy được ngay
 * trong Editor/preview; Bootloader gọi FBInstantManagerHolder.set(new FBInstantManager())
 * khi phát hiện FBInstant SDK đã nạp (build Facebook Instant Games thật).
 */
export class FBInstantManagerHolder {
    private static _current: IFBInstantManager = new MockFBInstantManager();

    static get current(): IFBInstantManager {
        return this._current;
    }

    static set(service: IFBInstantManager): void {
        this._current = service;
    }
}
