import { _decorator, CCString, Component, Sprite, SpriteFrame } from 'cc';
import { EventManager } from '../core/EventManager';
import { LANGUAGE_CHANGED_EVENT } from './LocalizationEvents';
import { Localization } from './Localization';

const { ccclass, property } = _decorator;

/**
 * Đổi SpriteFrame theo ngôn ngữ (ví dụ ảnh hướng dẫn có chữ: tutorial_vi / tutorial_en).
 *
 * `languages` và `frames` là hai mảng SONG SONG: languages[i] ↔ frames[i]. Ngôn ngữ
 * hiện tại không có trong danh sách thì dùng `fallbackFrame`.
 */
@ccclass('LocalizedSprite')
export class LocalizedSprite extends Component {
    @property({ type: Sprite, tooltip: 'Trống thì dùng cc.Sprite trên chính node này.' })
    target: Sprite | null = null;

    @property({
        type: [CCString],
        tooltip: 'Mã ngôn ngữ, ví dụ ["en","vi"]. Song song với "frames".',
    })
    languages: string[] = [];

    @property({ type: [SpriteFrame], tooltip: 'Ảnh cho từng ngôn ngữ, song song với "languages".' })
    frames: SpriteFrame[] = [];

    @property({ type: SpriteFrame, tooltip: 'Ảnh dùng khi ngôn ngữ hiện tại không có trong danh sách.' })
    fallbackFrame: SpriteFrame | null = null;

    onLoad(): void {
        if (!this.target) this.target = this.getComponent(Sprite);
    }

    onEnable(): void {
        EventManager.instance.on(LANGUAGE_CHANGED_EVENT, this.refresh, this);
        this.refresh();
    }

    onDisable(): void {
        EventManager.instance.off(LANGUAGE_CHANGED_EVENT, this.refresh, this);
    }

    onDestroy(): void {
        EventManager.instance.targetOff(this);
    }

    private refresh = (): void => {
        if (!this.target) return;

        const index = this.languages.indexOf(Localization.getCurrentLanguage());
        const frame = index >= 0 ? this.frames[index] ?? this.fallbackFrame : this.fallbackFrame;

        if (frame) this.target.spriteFrame = frame;
    };
}
