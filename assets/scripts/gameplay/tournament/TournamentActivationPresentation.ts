/**
 * Holder tĩnh cho popup "kích hoạt giải đấu Weekly" (dành riêng cho người chơi hoàn toàn mới,
 * chưa từng thắng màn campaign nào post-tutorial) — cùng mẫu StreakPresentation/
 * LeaderboardPreviewPresentation/TournamentPresentation: GameManager phát hiện điều kiện kích
 * hoạt đã đủ (GameManager.checkTournamentActivation(), gọi khi vừa quay lại màn Home) TRƯỚC khi
 * UIManager sẵn sàng nhận popup — .request() lưu tạm, UIManager .consume() khi tới lượt an toàn.
 */
export class TournamentActivationPresentation {
    private static _pending = false;

    static request(): void {
        this._pending = true;
    }

    static isPending(): boolean {
        return this._pending;
    }

    static consume(): boolean {
        const value = this._pending;
        this._pending = false;
        return value;
    }
}
