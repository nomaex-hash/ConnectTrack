/** Phát MỘT lần khi ngôn ngữ đổi — mọi LocalizedLabel/LocalizedSprite tự refresh. */
export const LANGUAGE_CHANGED_EVENT = 'LanguageChangedEvent';

export interface LanguageChangedEventPayload {
    readonly language: string;
}
