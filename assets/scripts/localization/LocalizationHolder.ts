import type { LocalizationManager } from './LocalizationManager';

/**
 * Giữ instance LocalizationManager cho facade Localization truy cập (giống
 * DailyServiceHolder). Dùng `import type` để không tạo phụ thuộc runtime vòng.
 */
export class LocalizationHolder {
    private static _current: LocalizationManager | null = null;

    static get current(): LocalizationManager | null {
        return this._current;
    }

    static set(manager: LocalizationManager | null): void {
        this._current = manager;
    }
}
