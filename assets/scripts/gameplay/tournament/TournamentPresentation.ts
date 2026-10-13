/**
 * Holder tĩnh cho popup Kết quả giải đấu (Claim/Continue) — cùng mẫu StreakPresentation/
 * LeaderboardPreviewPresentation: GameManager phát hiện có kết quả tuần trước đang chờ xử lý
 * (LeaderboardManager.hasPendingTournamentResult(), xem GameManager.checkPendingTournamentResult())
 * TRƯỚC khi UIManager sẵn sàng nhận popup — .request() lưu tạm, UIManager .consume() khi tới lượt
 * an toàn (mở app xong, hoặc sau khi đóng popup Result của màn vừa thắng).
 */
export interface TournamentResultSnapshot {
    readonly rank: number;
}

export class TournamentPresentation {
    private static _pending: TournamentResultSnapshot | null = null;

    static request(rank: number): void {
        this._pending = { rank };
    }

    static isPending(): boolean {
        return this._pending !== null;
    }

    static consume(): TournamentResultSnapshot | null {
        const value = this._pending;
        this._pending = null;
        return value;
    }
}
