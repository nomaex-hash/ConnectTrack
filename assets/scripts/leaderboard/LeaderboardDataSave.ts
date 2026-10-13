// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
import { configuration } from '../framework/configuration';
const { ccclass, property } = _decorator;

@ccclass('LeaderboardDataSave')
export class LeaderboardDataSave {
    lastWeekCheckReward: number = 0;
    claimedReward: number = 1;
    currWeek: number = 0;
    currWeekScore:number = 0;
    countWeek: number = 0;
    tutorialCompleted: number = 0;
    /** Hạng CUỐI CÙNG (1-based) của tuần vừa kết thúc, đang CHỜ người chơi bấm Claim/Continue ở
     * popup kết quả giải đấu — 0 = không có kết quả nào đang chờ xử lý. Khác 0 nghĩa là tuần đã
     * hết giờ nhưng CHƯA thực sự reset (xem LeaderboardManager.checkWeekRollover/
     * resolvePendingTournamentResult) — điểm/bot tuần cũ vẫn được giữ nguyên để hiển thị đúng kết
     * quả cho tới khi popup được xử lý xong. */
    pendingResultRank: number = 0;
    /** Mốc thời gian thực (ms, Date.now()) của lần tính "bù offline" gần nhất cho bot Weekly/Global
     * (xem LeaderboardManager.checkOfflineGrowth) — 0 = chưa từng tính (lần đầu). */
    lastOfflineCheckMs: number = 0;
    /** Mốc thời gian thực (ms, Date.now()) LÚC GIẢI ĐẤU TUẦN HIỆN TẠI BẮT ĐẦU — mỗi người chơi có
     * mốc RIÊNG (không chung 1 lịch cố định thứ 2 hàng tuần cho mọi người) — giải đấu tự hết hạn
     * SAU ĐÚNG 7 NGÀY kể từ mốc này (xem LeaderboardManager.checkWeekRollover/getTimeToNextWeek).
     * 0 = chưa từng có (lần đầu cài app). Được đặt lại = Date.now() mỗi khi
     * resolvePendingTournamentResult() chạy (bấm Claim/Got it) — bắt đầu đếm 7 ngày mới TỪ LÚC ĐÓ. */
    tournamentStartMs: number = 0;

    /** Số lần ĐÃ TỪNG đạt ĐÚNG hạng 1/2/3 lúc giải đấu Weekly kết thúc (tăng ở
     * LeaderboardManager.checkWeekRollover() ngay khi hạng cuối cùng được xác định — KHÔNG phải
     * lúc bấm nhận thưởng, để đúng dù người chơi đóng popup mà không bấm Collect). Dùng cho dòng
     * "You've won {ordinal} place {N} times" ở popup nhận thưởng Top 3 (RewardTop3.prefab). */
    timesTop1: number = 0;
    timesTop2: number = 0;
    timesTop3: number = 0;

    /** Điểm 50 bot giả Weekly hiện tại — PHẢI lưu file (khác comment cũ "mock, mất khi tắt app là
     * bình thường"), vì người chơi thấy bảng xếp hạng "reset" mỗi lần mở lại game là bug thật, bot
     * cần đứng yên đúng vị trí đã leo tới cho tới khi giải đấu thật sự reset (resolvePendingTournamentResult). */
    fakeBotScores: number[] = [];
    /** Tên + avatar tương ứng fakeBotScores (cùng index) — lưu kèm để không đổi "người" mỗi lần mở lại game. */
    fakeBotIdentities: { userName: string; avatarURL: string }[] = [];

    getStrLeaderboardDataSave() {
        let strLeaderboardData:string = "";
        strLeaderboardData += this.lastWeekCheckReward + "|";
        strLeaderboardData += this.claimedReward + "|";
        strLeaderboardData += this.currWeek + "|";
        strLeaderboardData += this.currWeekScore + "|";
        strLeaderboardData += this.countWeek + "|";
        strLeaderboardData += this.tutorialCompleted + "|";
        strLeaderboardData += this.pendingResultRank + "|";
        strLeaderboardData += this.lastOfflineCheckMs + "|";
        strLeaderboardData += this.tournamentStartMs + "|";
        strLeaderboardData += this.timesTop1 + "|";
        strLeaderboardData += this.timesTop2 + "|";
        strLeaderboardData += this.timesTop3 + "|";
        strLeaderboardData += this.fakeBotScores.join(",") + "|";
        strLeaderboardData += encodeURIComponent(JSON.stringify(this.fakeBotIdentities));
        return strLeaderboardData;
    }

    initLeaderboardDataSave(strLeaderboardData:string) {
        if(strLeaderboardData.length == 0 || strLeaderboardData.indexOf("|") == -1) return;
        let arrLeaderboardData = strLeaderboardData.split("|");
        if(arrLeaderboardData[0] && arrLeaderboardData[0].length > 0){
            this.lastWeekCheckReward = parseInt(arrLeaderboardData[0]);
        }

        if(arrLeaderboardData[1] && arrLeaderboardData[1].length > 0){
            this.claimedReward = parseInt(arrLeaderboardData[1]);
        }

        if(arrLeaderboardData[2] && arrLeaderboardData[2].length > 0){
            this.currWeek = parseInt(arrLeaderboardData[2]);
        }

        if(arrLeaderboardData[3] && arrLeaderboardData[3].length > 0){
            this.currWeekScore = parseInt(arrLeaderboardData[3]);
        }

        if(arrLeaderboardData[4] && arrLeaderboardData[4].length > 0){
            this.countWeek = parseInt(arrLeaderboardData[4]);
        }

        if(arrLeaderboardData[5] && arrLeaderboardData[5].length > 0){
            this.tutorialCompleted = parseInt(arrLeaderboardData[5]);
        }

        if(arrLeaderboardData[6] && arrLeaderboardData[6].length > 0){
            this.pendingResultRank = parseInt(arrLeaderboardData[6]);
        }

        if(arrLeaderboardData[7] && arrLeaderboardData[7].length > 0){
            this.lastOfflineCheckMs = parseInt(arrLeaderboardData[7]);
        }

        if(arrLeaderboardData[8] && arrLeaderboardData[8].length > 0){
            this.tournamentStartMs = parseInt(arrLeaderboardData[8]);
        }

        if(arrLeaderboardData[9] && arrLeaderboardData[9].length > 0){
            this.timesTop1 = parseInt(arrLeaderboardData[9]);
        }

        if(arrLeaderboardData[10] && arrLeaderboardData[10].length > 0){
            this.timesTop2 = parseInt(arrLeaderboardData[10]);
        }

        if(arrLeaderboardData[11] && arrLeaderboardData[11].length > 0){
            this.timesTop3 = parseInt(arrLeaderboardData[11]);
        }

        if(arrLeaderboardData[12] && arrLeaderboardData[12].length > 0){
            this.fakeBotScores = arrLeaderboardData[12].split(",").map((s) => parseInt(s));
        }

        if(arrLeaderboardData[13] && arrLeaderboardData[13].length > 0){
            try {
                this.fakeBotIdentities = JSON.parse(decodeURIComponent(arrLeaderboardData[13]));
            } catch (e) {
                this.fakeBotIdentities = [];
            }
        }
    }

    /** Tạo giải đấu MỚI — bắt đầu đếm 7 ngày TỪ ĐÂY (tournamentStartMs = Date.now()), không còn
     * phụ thuộc lịch chung (currWeek vẫn cập nhật, chỉ còn dùng cho context ID PGS/mock — KHÔNG
     * còn quyết định lúc nào giải đấu hết hạn nữa). */
    initNewLeaderboardDataSave(currWeek: number) {
        this.currWeekScore = 0;
        this.countWeek++;
        this.currWeek = currWeek;
        this.pendingResultRank = 0;
        this.tournamentStartMs = Date.now();
        this.fakeBotScores = [];
        this.fakeBotIdentities = [];
        configuration.instance.setData_Leaderboard(this.getStrLeaderboardDataSave());
    }
}


