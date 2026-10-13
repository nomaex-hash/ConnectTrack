/**
 * Danh mục avatar/frame người chơi có thể chọn — hiện chỉ có 1 lựa chọn mỗi loại (asset thật
 * chưa đủ), thêm id mới vào 2 mảng này khi có thêm art, KHÔNG cần đổi code nơi khác.
 * AvatarCatalogManager (Component, gắn trên AppManagers) giữ SpriteFrame thật cho từng id
 * theo ĐÚNG THỨ TỰ 2 mảng này.
 */
export const AVATAR_IDS: readonly string[] = ['avatar_0'];
export const FRAME_IDS: readonly string[] = ['frame_0'];

export const DEFAULT_AVATAR_ID = AVATAR_IDS[0];
export const DEFAULT_FRAME_ID = FRAME_IDS[0];
