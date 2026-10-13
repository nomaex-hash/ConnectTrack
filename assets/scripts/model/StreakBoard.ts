
export interface StreakDay {
    readonly date: string; 
    readonly weekday: number; 
    readonly checked: boolean; 
    readonly isReward: boolean; 
}


export interface StreakBoard {
    readonly streak: number;
    readonly bestStreak: number;

    readonly days: readonly StreakDay[];

    /** Đã đạt tới ngày chứa hộp quà (ô cuối được tích) → có thể nhận. */
    readonly rewardReady: boolean;
    /** Đã nhận quà của chu kỳ hiện tại chưa. */
    readonly rewardClaimed: boolean;
    /**
     * Đã hoàn thành hoạt động của HÔM NAY chưa (khác `streak > 0` — chuỗi vẫn còn giá trị
     * từ hôm qua tới hết hôm nay, nhưng nếu chưa chơi gì hôm nay thì màn Chuỗi vẫn phải
     * hiện lời nhắc "chơi để giữ chuỗi", không hiện như đã "thắp sáng" xong xuôi.
     */
    readonly playedToday: boolean;
}
