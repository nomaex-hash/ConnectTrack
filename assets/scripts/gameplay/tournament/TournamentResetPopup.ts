import { _decorator, Button } from 'cc';
import { UIPopup } from '../../ui/UIPopup';
import { GameManager } from '../../manager/GameManager';
import { LeaderboardManager as LegacyLeaderboardManager } from '../../leaderboard/LeaderboardManager';
import { Constants } from '../../framework/constants';
import { CountDownTimeEvent } from '../../common/CountDownTimeEvent';
const { ccclass, property } = _decorator;

/**
 * Popup "New Session" — dùng CHUNG cho CẢ 2 trường hợp bắt đầu 1 giải đấu, vì hành động lẫn giao
 * diện giống hệt nhau (chỉ khác đang KÍCH HOẠT LẦN ĐẦU hay CHỐT SỔ tuần cũ để bắt đầu tuần mới):
 *   1. Người chơi hoàn toàn mới, CHƯA từng kích hoạt giải đấu (LeaderboardManager.
 *      hasTournamentActivated() == false) — trước đây có 1 popup RIÊNG (TournamentActivationPopup,
 *      đã disconnect, không xoá file) chỉ khác đúng 1 dòng code (activateTournament() thay vì
 *      resolveTournamentContinue()) — không đáng để duy trì 2 file gần như giống hệt nhau.
 *   2. Giải đấu ĐANG chạy vừa hết giờ và người chơi KHÔNG lọt Top 3 (UIManager tự chọn mở popup
 *      này hay TournamentResultPopup dựa vào hạng — 2 popup tách biệt hoàn toàn, không có chuỗi
 *      nối tiếp giữa chúng).
 *
 * onShow() tự phát hiện đúng trường hợp qua hasTournamentActivated() rồi gọi đúng hàm — "Chốt sổ"/
 * "Kích hoạt" đều chạy NGAY LÚC POPUP HIỆN LÊN, KHÔNG đợi người chơi bấm "Got it". Cả nút "Got it"
 * lẫn dấu X (btnClose) chỉ còn tác dụng ĐÓNG popup — giải đấu đã bắt đầu tính giờ từ lúc popup
 * xuất hiện, bấm nút nào (hoặc đóng kiểu nào) cũng không ảnh hưởng gì.
 */
@ccclass('TournamentResetPopup')
export class TournamentResetPopup extends UIPopup<void> {
    @property({ type: Button, tooltip: 'Nút "Got it" — chỉ đóng popup (giải đấu mới đã bắt đầu tính giờ từ lúc popup hiện lên).' })
    btnGotIt: Button | null = null;

    @property({ type: Button, tooltip: 'Nút dấu X — chỉ đóng popup (giải đấu mới đã bắt đầu tính giờ từ lúc popup hiện lên).' })
    btnClose: Button | null = null;

    @property({
        type: CountDownTimeEvent,
        tooltip:
            'Đếm ngược tới khi giải đấu MỚI (vừa bắt đầu ngay lúc popup này hiện lên) kết thúc — ' +
            'đọc THẬT từ LeaderboardManager.getTimeToNextWeek() (không còn số xem-trước cố định ' +
            'nữa, vì giải đấu đã kích hoạt thật ngay từ onShow()). Dùng CHUNG component ' +
            'CountDownTimeEvent với tab Weekly/LeaderboardPreviewPopup.',
    })
    countDownTimeNextWeek: CountDownTimeEvent | null = null;

    protected onEnable(): void {
        this.btnGotIt?.node.on(Constants.CLICK, this.onTouchGotIt, this);
        this.btnClose?.node.on(Constants.CLICK, this.onTouchClose, this);
    }

    protected onDisable(): void {
        this.btnGotIt?.node.off(Constants.CLICK, this.onTouchGotIt, this);
        this.btnClose?.node.off(Constants.CLICK, this.onTouchClose, this);
    }

    protected onShow(): void {
        // Không có bước tải nào — tắt loading NGAY (UIPopup.showLoading() tự bật lúc show()).
        this.hideLoading();
        const legacy = LegacyLeaderboardManager.instance;

        // Chưa từng kích hoạt (người chơi hoàn toàn mới) → kích hoạt LẦN ĐẦU. Đã kích hoạt rồi
        // (giải đấu đang chạy vừa hết giờ) → resolveTournamentContinue() chỉ thật sự chạy khi có
        // pendingResultRank != 0 (xem LeaderboardManager.resolvePendingTournamentResult()) — gọi
        // nhầm activateTournament() ở trường hợp này sẽ KHÔNG làm gì (activateTournament() tự early
        // return nếu đã kích hoạt), nên phải phân biệt đúng 2 nhánh, không gộp gọi cả 2.
        if (!legacy?.hasTournamentActivated()) {
            legacy?.activateTournament();
        } else {
            GameManager.instance?.resolveTournamentContinue();
        }

        if (this.countDownTimeNextWeek && legacy) {
            this.countDownTimeNextWeek.initCountDownTime(legacy.getTimeToNextWeek(), () => {});
        }
    }

    private onTouchGotIt(): void {
        this.requestClose();
    }

    private onTouchClose(): void {
        this.requestClose();
    }
}
