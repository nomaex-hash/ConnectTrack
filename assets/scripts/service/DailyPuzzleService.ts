import { DailyPuzzleData } from '../model/DailyPuzzleData';
import { StreakBoard, StreakDay } from '../model/StreakBoard';
import { RankTier } from '../core/RankTier';
import { StreakConfig } from '../config/StreakConfig';
import { LevelListConfig } from '../config/LevelListConfig';
import { today, daysBetween, addDays, weekdayOf } from '../utility/DateUtil';

export interface StreakActivityResult {
    readonly firstToday: boolean;
    readonly streak: number;
}

export class DailyPuzzleService {
    constructor(private readonly data: DailyPuzzleData) {}


    get lastDailySeconds(): number | null {
        return this.data.lastDailySeconds;
    }

    get lastDailyScore(): number | null {
        return this.data.lastDailyScore;
    }

    get lastDailyRank(): RankTier | null {
        return this.data.lastDailyRank;
    }

    isDailyDoneToday(now: string = today()): boolean {
        return this.data.lastDailyDate === now;
    }

    getPuzzleIdFor(date: string = today()): number {
        const hash = fnv1a(date);
        return (hash % LevelListConfig.dailyPuzzleCount) + 1;
    }

    
    completeDailyChallenge(seconds: number, score: number, rank: RankTier, now: string = today()): void {
        this.data.lastDailyDate = now;
        this.data.lastDailySeconds = seconds;
        this.data.lastDailyScore = score;
        this.data.lastDailyRank = rank;
    }


    /**
     * Chuỗi hiện tại — nếu đã lỡ mất >1 ngày kể từ lần chơi gần nhất mà NGƯỜI CHƠI CHƯA
     * CHƠI LẠI, coi như chuỗi đã đứt (trả 0) dù `data.streak` trong save chưa được ghi đè.
     * Việc ghi đè thật sự (reset về 1) chỉ xảy ra ở advanceStreak() vào lần chơi kế tiếp —
     * getter này chỉ để HIỂN THỊ đúng ngay cả khi người chơi chỉ MỞ màn Chuỗi lên xem mà
     * chưa chơi gì, tránh hiện số cũ như thể chuỗi vẫn còn nguyên.
     */
    get streak(): number {
        return this.isStreakExpired(today()) ? 0 : this.data.streak;
    }

    get bestStreak(): number {
        return this.data.bestStreak;
    }

    private isStreakExpired(now: string): boolean {
        const last = this.data.streakLastDate;
        if (last === null) return false;
        return daysBetween(last, now) > 1;
    }


    recordActivity(now: string = today()): StreakActivityResult {
        if (this.data.streakLastDate === now) {
            return { firstToday: false, streak: this.data.streak };
        }
        if (this.data.streakLastDate !== null && daysBetween(this.data.streakLastDate, now) <= 0) {
            return { firstToday: false, streak: this.data.streak };
        }

        const didReset = this.advanceStreak(now);
        this.updateWindow(now, didReset);

        this.data.streakLastDate = now;
        if (this.data.streak > this.data.bestStreak) {
            this.data.bestStreak = this.data.streak;
        }

        return { firstToday: true, streak: this.data.streak };
    }


    /** DÙNG ĐỂ TEST — ghi thẳng SỐ chuỗi (data.streak), KHÔNG đụng gì tới dayRow (checkedDates/
     * anchor) — xác nhận từ user: "thêm 1 edit box khi nhập vào thì hiện số chuỗi đúng như thế
     * (không liên quan đến dayrow)". streakLastDate luôn đặt về `now` để số vừa nhập không bị
     * isStreakExpired() ghi đè về 0 ngay khi hiện lại màn Streak. */
    setTestStreakValue(value: number, now: string = today()): void {
        const streak = Math.max(0, Math.floor(value));
        this.data.streak = streak;
        if (streak > this.data.bestStreak) this.data.bestStreak = streak;
        this.data.streakLastDate = now;
    }

    /** DÙNG ĐỂ TEST — ép dayRow tuần hiện tại thành ĐÃ ĐIỂM DANH ĐÚNG 6/7 ngày (ngày quà — ô cuối —
     * CÒN TRỐNG), để chơi xong 1 màn NGAY HÔM NAY là đủ điều kiện thắp chuỗi ngày 7/nhận quà — xác
     * nhận từ user: "1 nút khi bấm vào thì chuỗi trong tuần nhảy đến 6 ngày và chơi 1 màn nữa là
     * thắp được chuỗi ngày thứ 7... chỉ liên quan đến dayrow, không liên quan đến số chuỗi". KHÔNG
     * đụng gì tới streak/bestStreak. streakLastDate đặt về HÔM QUA (không phải hôm nay) để lần chơi
     * tiếp theo (hôm nay) tính đúng gap=1 ở advanceStreak(), số chuỗi tiếp tục tự nhiên thay vì bị
     * coi là đứt quãng rồi reset về 1. */
    setTestWeekToDaySix(now: string = today()): void {
        const anchor = addDays(now, -(StreakConfig.windowDays - 1));
        this.data.streakAnchorDate = anchor;
        this.data.checkedDates = [];
        for (let i = 0; i < StreakConfig.windowDays - 1; i++) {
            this.data.checkedDates.push(addDays(anchor, i));
        }
        this.data.rewardClaimedForAnchor = false;
        this.data.streakLastDate = addDays(now, -1);
    }

    /** DÙNG ĐỂ TEST — bỏ dấu "đã chơi hôm nay" khỏi checkedDates, KHÔNG đụng gì tới streak/
     * bestStreak/anchor — xác nhận từ user: "giữ nguyên số streak, chỉ đánh dấu chưa chơi hôm nay"
     * (khác hẳn resetStreak() — đưa streak về 0 hoàn toàn). Render lại màn Streak sau lệnh này sẽ
     * rơi vào enterLockedMode() (board.streak>0 && !playedToday — "chơi để giữ chuỗi"), test lại
     * được luồng thắp chuỗi (tap sun) nhiều lần mà KHÔNG mất số đã tích luỹ.
     *
     * streakLastDate PHẢI lùi về HÔM QUA (không giữ nguyên hôm nay) — nếu không, recordActivity()
     * ở lần "chơi lại" kế tiếp sẽ thấy streakLastDate===now ngay dòng đầu tiên và return sớm
     * (firstToday:false, coi như "đã ghi nhận hôm nay rồi"), streak KHÔNG cộng thêm dù checkedDates
     * đã bị gỡ dấu — lùi về hôm qua để advanceStreak() tính đúng gap=1 (cộng dồn tiếp, KHÔNG đứt
     * quãng), y hệt kỹ thuật đã dùng ở setTestWeekToDaySix(). */
    setTestNotPlayedToday(now: string = today()): void {
        const index = this.data.checkedDates.indexOf(now);
        if (index >= 0) this.data.checkedDates.splice(index, 1);
        if (this.data.streakLastDate === now) this.data.streakLastDate = addDays(now, -1);
    }

    resetStreak(): void {
        this.data.streak = 0;
        this.data.bestStreak = 0;
        this.data.streakLastDate = null;
        this.data.streakAnchorDate = null;
        this.data.checkedDates = [];
        this.data.rewardClaimedForAnchor = false;
    }

    /**
     * Chu kỳ 7 ngày hiện tại có còn HỢP LỆ để hiện hàng ngày đã lưu (checkedDates/anchor)
     * hay không — tương tự isStreakExpired, chỉ để HIỂN THỊ đúng ngay cả khi người chơi CHƯA
     * CHƠI GÌ ở chu kỳ mới; việc ghi đè dữ liệu thật sự (neo lại chu kỳ mới) chỉ xảy ra ở
     * updateWindow() vào lần chơi kế tiếp. PHẢI reset (dayRow trống, tự trượt theo hôm nay)
     * nếu: (a) chưa từng chơi lần nào, (b) CHUỖI ĐÃ ĐỨT (streak về 0 — dữ liệu checkedDates
     * cũ giờ vô nghĩa, không được để sót lại ô đã tích), hoặc (c) chu kỳ cũ đã chạy đủ 7
     * ngày (đã qua ngày quà, dù chuỗi vẫn đang tiếp diễn không đứt).
     */
    private isCycleReset(now: string): boolean {
        const anchor = this.data.streakAnchorDate;
        if (anchor === null) return true;
        if (this.isStreakExpired(now)) return true;
        return daysBetween(anchor, now) >= StreakConfig.windowDays;
    }

    getStreakBoard(now: string = today()): StreakBoard {
        const freshCycle = this.isCycleReset(now);
        const anchor = freshCycle ? now : this.data.streakAnchorDate!;
        const size = StreakConfig.windowDays;
        const checked = freshCycle ? new Set<string>() : new Set(this.data.checkedDates);

        const days: StreakDay[] = [];
        for (let i = 0; i < size; i++) {
            const date = addDays(anchor, i);
            days.push({
                date,
                weekday: weekdayOf(date),
                checked: checked.has(date),
                isReward: i === size - 1,
            });
        }

        const lastDay = days[size - 1];
        return {
            streak: this.isStreakExpired(now) ? 0 : this.data.streak,
            bestStreak: this.data.bestStreak,
            days,
            rewardReady: lastDay ? lastDay.checked : false,
            rewardClaimed: freshCycle ? false : this.data.rewardClaimedForAnchor,
            playedToday: checked.has(now),
        };
    }

    /**
     * Nhận quà cuối chu kỳ. Chỉ nhận được khi đã tới ngày quà và CHƯA nhận. Trả về
     * số lượt Place Dog thưởng (0 nếu không đủ điều kiện / đã nhận).
     */
    claimReward(now: string = today()): number {
        const board = this.getStreakBoard(now);
        if (!board.rewardReady || board.rewardClaimed) return 0;

        this.data.rewardClaimedForAnchor = true;
        return StreakConfig.rewardPlaceDogCharges;
    }


    /**
     * Tăng chuỗi nếu chơi đúng ngày kế tiếp; bỏ lỡ bất kỳ ngày nào đều reset
     * về 1 (không có cơ chế khoan hồng/recovery). Trả về true nếu chuỗi vừa
     * được bắt đầu lại (reset hoặc lần đầu), để updateWindow neo lại cửa sổ.
     */
    private advanceStreak(now: string): boolean {
        if (this.data.streakLastDate === null) {
            this.data.streak = 1;
            return true;
        }

        const gap = daysBetween(this.data.streakLastDate, now);
        if (gap === 1) {
            this.data.streak += 1;
            return false;
        }

        this.data.streak = 1;
        return true;
    }


    private updateWindow(now: string, forceNewAnchor: boolean): void {
        const anchor = this.data.streakAnchorDate;
        const inWindow =
            !forceNewAnchor &&
            anchor !== null &&
            daysBetween(anchor, now) >= 0 &&
            daysBetween(anchor, now) < StreakConfig.windowDays;

        if (!inWindow) {
            this.data.streakAnchorDate = now;
            this.data.checkedDates = [now];
            this.data.rewardClaimedForAnchor = false;
            return;
        }

        if (this.data.checkedDates.indexOf(now) < 0) {
            this.data.checkedDates.push(now);
        }
    }
}

function fnv1a(value: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}
