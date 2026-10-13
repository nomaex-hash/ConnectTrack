import { ProfileSaveData } from '../../model/ProfileSaveData';
import { AVATAR_IDS, FRAME_IDS } from '../../config/AvatarCatalogConfig';

/** Trạng thái avatar/frame người chơi TỰ CHỌN — KHÔNG tự gọi backend, chỉ giữ lựa chọn cục bộ. */
export class ProfileManager {
    constructor(private readonly data: ProfileSaveData) {}

    get avatarId(): string {
        return this.data.avatarId;
    }

    get frameId(): string {
        return this.data.frameId;
    }

    setAvatar(avatarId: string): void {
        if (AVATAR_IDS.indexOf(avatarId) === -1) return;
        this.data.avatarId = avatarId;
    }

    setFrame(frameId: string): void {
        if (FRAME_IDS.indexOf(frameId) === -1) return;
        this.data.frameId = frameId;
    }
}
