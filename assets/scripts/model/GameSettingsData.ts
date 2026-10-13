
export interface GameSettingsData {
    bgmVolume: number; // 0..1
    sfxVolume: number; // 0..1
    vibration: boolean;
    /** Mã ngôn ngữ, ví dụ 'en' | 'vi'. Xem localization/Language.ts. */
    language: string;
}
