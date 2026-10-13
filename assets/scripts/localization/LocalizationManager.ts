import { _decorator, Component, JsonAsset, resources } from 'cc';
import { EventManager } from '../core/EventManager';
import {
    SETTINGS_CHANGE_REQUESTED_EVENT,
    SettingsChangeRequestedEventPayload,
} from '../event/AppEvents';
import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES, isSupportedLanguage } from './Language';
import { LANGUAGE_CHANGED_EVENT, LanguageChangedEventPayload } from './LocalizationEvents';
import { LocalizationHolder } from './LocalizationHolder';

const { ccclass } = _decorator;

type Dictionary = Record<string, unknown>;

const RESOURCE_DIR = 'localization';

/**
 * Lõi Localization — Component đặt trên node AppManagers (persist).
 *
 * - Nạp file JSON MỘT lần cho mỗi ngôn ngữ rồi CACHE (không load lại mỗi lần get).
 * - Đổi ngôn ngữ runtime → emit LANGUAGE_CHANGED_EVENT (một lần) + xin lưu save.
 * - Thiếu key → thử ngôn ngữ fallback → cuối cùng trả chính key (dev thấy ngay).
 *
 * Public API dùng qua facade `Localization` (Localization.ts).
 */
@ccclass('LocalizationManager')
export class LocalizationManager extends Component {
    private readonly dicts = new Map<string, Dictionary>();
    private current = FALLBACK_LANGUAGE;
    private fallbackDict: Dictionary = {};

    onLoad(): void {
        LocalizationHolder.set(this);
    }

    onDestroy(): void {
        if (LocalizationHolder.current === this) LocalizationHolder.set(null);
    }

    /** Nạp TOÀN BỘ ngôn ngữ hỗ trợ (chỉ vài file JSON nhỏ, xem SUPPORTED_LANGUAGES) song song ngay
     * ở Bootloader — không chỉ fallback + ngôn ngữ ban đầu. Thiếu bước này thì lần ĐẦU TIÊN người
     * chơi đổi sang 1 ngôn ngữ khác ngôn ngữ đã lưu (ví dụ máy đang 'en', đổi sang 'vi' lần đầu)
     * phải resources.load() ngay lúc bấm, gây giật rõ rệt — cùng nguyên nhân "chưa load xong" như
     * các bug tải-trễ khác đã gặp trong dự án. */
    async init(language: string): Promise<void> {
        await Promise.all(SUPPORTED_LANGUAGES.map((lang) => this.ensureLoaded(lang.code)));
        this.fallbackDict = this.dicts.get(FALLBACK_LANGUAGE) ?? {};
        await this.applyLanguage(language, false, false);
    }

    get currentLanguage(): string {
        return this.current;
    }

    get(key: string): string {
        const value = this.dicts.get(this.current)?.[key];
        if (typeof value === 'string') return value;

        const fallback = this.fallbackDict[key];
        return typeof fallback === 'string' ? fallback : key;
    }

    /** Đọc key có giá trị là MẢNG chuỗi trong JSON (ví dụ danh sách câu khích lệ ngẫu nhiên). */
    getList(key: string): string[] {
        const value = this.dicts.get(this.current)?.[key] ?? this.fallbackDict[key];
        return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
    }

    has(key: string): boolean {
        return this.dicts.get(this.current)?.[key] !== undefined;
    }

    /** Đổi ngôn ngữ: nạp (nếu chưa cache), lưu save, refresh UI. */
    async setLanguage(language: string): Promise<void> {
        await this.applyLanguage(language, true, true);
    }

    /** Nạp lại toàn bộ dict (dùng khi sửa JSON lúc dev). */
    async reload(): Promise<void> {
        this.dicts.clear();
        await this.init(this.current);
        this.emitChanged();
    }

    private async applyLanguage(language: string, persist: boolean, emit: boolean): Promise<void> {
        const target = isSupportedLanguage(language) ? language : FALLBACK_LANGUAGE;
        await this.ensureLoaded(target);
        this.current = target;

        if (persist) {
            // Tái dùng luồng settings có sẵn (GameManager ghi + persist) — không phụ
            // thuộc trực tiếp SaveManager.
            const payload: SettingsChangeRequestedEventPayload = { language: target };
            EventManager.instance.emit(SETTINGS_CHANGE_REQUESTED_EVENT, payload);
        }
        if (emit) this.emitChanged();
    }

    private emitChanged(): void {
        const payload: LanguageChangedEventPayload = { language: this.current };
        EventManager.instance.emit(LANGUAGE_CHANGED_EVENT, payload);
    }

    private async ensureLoaded(language: string): Promise<void> {
        if (this.dicts.has(language)) return;
        this.dicts.set(language, await this.loadDictionary(language));
    }

    private loadDictionary(language: string): Promise<Dictionary> {
        return new Promise<Dictionary>((resolve) => {
            resources.load(`${RESOURCE_DIR}/${language}`, JsonAsset, (error, asset) => {
                if (error || !asset || !asset.json) {
                    console.warn(
                        `[LocalizationManager] Không nạp được '${RESOURCE_DIR}/${language}': ` +
                            `${error ? error.message : 'JSON rỗng'}`,
                    );
                    resolve({});
                    return;
                }
                resolve(asset.json as Dictionary);
            });
        });
    }
}
