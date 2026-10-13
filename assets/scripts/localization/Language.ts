export type LanguageCode = string;

export interface LanguageInfo {
    readonly code: LanguageCode;
    /** Tên hiển thị trong menu chọn ngôn ngữ. */
    readonly name: string;
}

/** Ngôn ngữ mặc định khi chưa có save. */
export const DEFAULT_LANGUAGE: LanguageCode = 'en';

/** Ngôn ngữ dùng khi thiếu key ở ngôn ngữ hiện tại. */
export const FALLBACK_LANGUAGE: LanguageCode = 'en';

/**
 * Danh sách ngôn ngữ được hỗ trợ. Thêm ngôn ngữ mới chỉ cần:
 *   1. thêm một dòng vào đây,
 *   2. thêm file `resources/localization/<code>.json`.
 */
export const SUPPORTED_LANGUAGES: readonly LanguageInfo[] = [
    { code: 'en', name: 'English' },
    { code: 'vi', name: 'Tiếng Việt' },
];

export function isSupportedLanguage(code: string): boolean {
    return SUPPORTED_LANGUAGES.some((lang) => lang.code === code);
}
