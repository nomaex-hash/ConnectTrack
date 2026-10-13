import { assetManager, ImageAsset, SpriteFrame, Texture2D } from 'cc';

const spriteFrameCache = new Map<string, SpriteFrame>();
const pendingCallbacks = new Map<string, ((spriteFrame: SpriteFrame | null) => void)[]>();

/**
 * Tải 1 URL ảnh (vd FBInstant.player.getPhoto()) thành SpriteFrame để gán trực tiếp vào
 * Sprite.spriteFrame — dùng cho avatar Leaderboard (Dogdoku không có hệ thống avatar cục bộ
 * như bản gốc, chỉ có ảnh thật từ Facebook/backend). Có cache theo URL để không tải lại khi
 * cùng 1 người chơi xuất hiện nhiều dòng/lần load lại danh sách.
 */
export function loadRemoteSpriteFrame(url: string, callback: (spriteFrame: SpriteFrame | null) => void): void {
    if (!url) {
        callback(null);
        return;
    }

    const cached = spriteFrameCache.get(url);
    if (cached) {
        callback(cached);
        return;
    }

    const waiters = pendingCallbacks.get(url);
    if (waiters) {
        waiters.push(callback);
        return;
    }
    pendingCallbacks.set(url, [callback]);

    assetManager.loadRemote<ImageAsset>(url, { ext: '.png' }, (error, imageAsset) => {
        const listeners = pendingCallbacks.get(url) ?? [];
        pendingCallbacks.delete(url);

        if (error || !imageAsset) {
            console.warn(`[RemoteImageLoader] Tải ảnh thất bại '${url}':`, error);
            for (const listener of listeners) listener(null);
            return;
        }

        const texture = new Texture2D();
        texture.image = imageAsset;
        const spriteFrame = new SpriteFrame();
        spriteFrame.texture = texture;

        spriteFrameCache.set(url, spriteFrame);
        for (const listener of listeners) listener(spriteFrame);
    });
}
