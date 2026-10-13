import { IAdService } from './IAdService';
import { MockAdService } from './MockAdService';

/**
 * Định vị dịch vụ quảng cáo hiện hành. Mặc định là MockAdService để chạy được ngay;
 * khi tích hợp SDK thật gọi AdServiceHolder.set(new AdMobService()) lúc khởi động.
 */
export class AdServiceHolder {
    private static _current: IAdService = new MockAdService();

    static get current(): IAdService {
        return this._current;
    }

    static set(service: IAdService): void {
        this._current = service;
    }
}
