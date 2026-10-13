import { FALLBACK_LANGUAGE } from './Language';
import { LocalizationHolder } from './LocalizationHolder';

/**
 * Facade tĩnh — API công khai của hệ localization. Mọi nơi trong game dùng
 * `Localization.get(key)` thay vì gọi thẳng manager.
 *
 * An toàn khi manager chưa khởi tạo: get() trả chính key thay vì ném lỗi.
 */
export class Localization {
    static get(key: string): string {
        return LocalizationHolder.current?.get(key) ?? key;
    }

    static has(key: string): boolean {
        return LocalizationHolder.current?.has(key) ?? false;
    }

    /** Đọc key có giá trị là mảng chuỗi trong JSON. */
    static getList(key: string): string[] {
        return LocalizationHolder.current?.getList(key) ?? [];
    }

    /** Chọn NGẪU NHIÊN một chuỗi trong mảng ở key — dùng cho text khích lệ/khen ngẫu nhiên. */
    static getRandom(key: string): string {
        const list = Localization.getList(key);
        if (list.length === 0) return '';
        return list[Math.floor(Math.random() * list.length)] ?? '';
    }

    static setLanguage(language: string): void {
        void LocalizationHolder.current?.setLanguage(language);
    }

    static getCurrentLanguage(): string {
        return LocalizationHolder.current?.currentLanguage ?? FALLBACK_LANGUAGE;
    }

    static reload(): void {
        void LocalizationHolder.current?.reload();
    }
}
