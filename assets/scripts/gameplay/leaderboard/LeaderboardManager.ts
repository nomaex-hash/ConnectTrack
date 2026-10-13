import { ccenum } from 'cc';
import { BackendConfig } from '../../config/BackendConfig';
import { LeaderboardDataSave } from '../../model/LeaderboardDataSave';

/** 2 tab của màn Leaderboard — dùng cho ItemTabLeaderboard/LeaderboardTabGroupManager. */
export enum LEADERBOARD_TAB_TYPE {
    WEEK = 0,
    WORLD = 1,
}
// Bắt buộc — thiếu dòng này thì @property({ type: LEADERBOARD_TAB_TYPE }) không hiện dropdown
// trong Inspector (chỉ hiện ô trống), vì CCClass không tự nhận diện enum TS thường.
ccenum(LEADERBOARD_TAB_TYPE);

/** Mốc gốc 3/11/2025 — lưu ý Date() dùng tháng 0-index nên tháng 11 truyền vào là 10. */
const WEEK_START_DATE = new Date(2025, 10, 3);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Trạng thái leaderboard THUẦN (tuần/thế giới) — KHÔNG tự gọi backend. GameManager là nơi
 * phối hợp: recordWin() lấy điểm tuần mới -> ScoreBackendService.submitScore() cho cả
 * context tuần lẫn thế giới (điểm world dùng level cao nhất, theo đúng dự án gốc).
 */
export class LeaderboardManager {
    constructor(private readonly data: LeaderboardDataSave) {
        this.rolloverIfNewWeek();
    }

    /** Chỉ số tuần hiện tại theo đồng hồ máy — 0-based, tính từ WEEK_START_DATE. */
    static currentWeekIndex(now: Date = new Date()): number {
        const days = Math.floor((now.getTime() - WEEK_START_DATE.getTime()) / ONE_DAY_MS);
        return Math.max(0, Math.floor(days / 7));
    }

    static weekContextIdFor(weekIndex: number): string {
        return `${BackendConfig.gameId}_week_${weekIndex}`;
    }

    /** Số giây tới khi sang tuần mới (Chủ Nhật kế tiếp) — mirror LeaderboardManager.getTimeToNextWeek() gốc. */
    static secondsToNextWeek(now: Date = new Date()): number {
        const lastDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 7);
        return Math.floor((lastDate.getTime() - now.getTime()) / 1000) + 86400;
    }

    get currWeek(): number {
        return this.data.currWeek;
    }

    get currWeekScore(): number {
        return this.data.currWeekScore;
    }

    get weekContextId(): string {
        return LeaderboardManager.weekContextIdFor(this.data.currWeek);
    }

    get worldContextId(): string {
        return `${BackendConfig.gameId}_world`;
    }

    get tutorialCompleted(): boolean {
        return this.data.tutorialCompleted;
    }

    setTutorialCompleted(): void {
        this.data.tutorialCompleted = true;
    }

    /** Gọi mỗi lần thắng 1 màn campaign — tăng bộ đếm tuần, tự rollover nếu đã sang tuần mới. */
    recordWin(): number {
        this.rolloverIfNewWeek();
        this.data.currWeekScore++;
        return this.data.currWeekScore;
    }

    /**
     * Thưởng top-3 TUẦN TRƯỚC chưa nhận — trả về hạng (0,1,2) nếu đủ điều kiện, null nếu
     * không có gì để nhận (chưa xếp hạng, không lọt top 3, hoặc đã nhận rồi).
     */
    checkWeeklyReward(myRankLastWeek: number | null): number | null {
        if (this.data.currWeek < 1) return null;
        if (this.data.lastWeekCheckReward === this.data.currWeek) return null;

        this.data.lastWeekCheckReward = this.data.currWeek;
        this.data.weeklyRewardClaimed = false;

        if (myRankLastWeek !== null && myRankLastWeek >= 0 && myRankLastWeek < 3) {
            return myRankLastWeek;
        }
        return null;
    }

    claimWeeklyReward(): void {
        this.data.weeklyRewardClaimed = true;
    }

    private rolloverIfNewWeek(): void {
        const nowWeek = LeaderboardManager.currentWeekIndex();
        if (this.data.currWeek < nowWeek) {
            this.data.currWeek = nowWeek;
            this.data.currWeekScore = 0;
        }
    }
}
