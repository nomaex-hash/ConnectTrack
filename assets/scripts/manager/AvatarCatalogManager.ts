import { _decorator, Component, SpriteFrame } from 'cc';
import { AVATAR_IDS, FRAME_IDS } from '../config/AvatarCatalogConfig';

const { ccclass, property } = _decorator;

/**
 * Giữ SpriteFrame thật cho từng avatar/frame trong AvatarCatalogConfig — gắn trên node
 * AppManagers. 2 mảng arrAvatarFrames/arrFrameFrames PHẢI cùng thứ tự + cùng độ dài với
 * AVATAR_IDS/FRAME_IDS (index [i] ứng với id thứ [i]).
 */
@ccclass('AvatarCatalogManager')
export class AvatarCatalogManager extends Component {
    private static _instance: AvatarCatalogManager | null = null;
    static get instance(): AvatarCatalogManager {
        if (!this._instance) throw new Error('AvatarCatalogManager chưa được khởi tạo.');
        return this._instance;
    }

    @property({ type: [SpriteFrame], tooltip: 'Cùng thứ tự với AVATAR_IDS trong AvatarCatalogConfig.ts.' })
    arrAvatarFrames: SpriteFrame[] = [];

    @property({ type: [SpriteFrame], tooltip: 'Cùng thứ tự với FRAME_IDS trong AvatarCatalogConfig.ts.' })
    arrFrameFrames: SpriteFrame[] = [];

    onLoad(): void {
        AvatarCatalogManager._instance = this;
    }

    getAvatarSpriteFrame(avatarId: string): SpriteFrame | null {
        const index = AVATAR_IDS.indexOf(avatarId);
        return index >= 0 ? this.arrAvatarFrames[index] ?? null : null;
    }

    getFrameSpriteFrame(frameId: string): SpriteFrame | null {
        const index = FRAME_IDS.indexOf(frameId);
        return index >= 0 ? this.arrFrameFrames[index] ?? null : null;
    }
}
