import { AppState } from '../core/AppState';

type Preparer = (state: AppState) => Promise<void>;

let current: Preparer | null = null;

/**
 * Cầu nối để GameManager (tầng logic, KHÔNG import UI) chờ prefab màn hình lazy nạp xong TRƯỚC khi
 * đổi state. Cần thiết vì GameManager.startPuzzle() gọi changeState(Gameplay) rồi NGAY SAU ĐÓ tạo/phát
 * PuzzleSession, giả định GameplayScreen được dựng đồng bộ lúc đổi state để kịp nhận sự kiện. Nếu prefab
 * còn đang tải thì màn dựng muộn, sự kiện bắt đầu màn đã phát xong và board không bao giờ được vẽ.
 * UIManager đăng ký hàm chuẩn bị ở attachToScene().
 */
export const ScreenPreparer = {
    set(preparer: Preparer | null): void {
        current = preparer;
    },
    prepare(state: AppState): Promise<void> {
        return current ? current(state) : Promise.resolve();
    },
};
