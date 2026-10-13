import { _decorator, Button } from 'cc';
import { UIPopup } from '../../ui/UIPopup';
import { LeaderboardManager as LegacyLeaderboardManager } from '../../leaderboard/LeaderboardManager';
import { Constants } from '../../framework/constants';
import { CountDownTimeEvent } from '../../common/CountDownTimeEvent';
const { ccclass, property } = _decorator;

/**
 * Popup "kích hoạt giải đấu Weekly" — CHỈ hiện cho người chơi hoàn toàn mới (đi từ tutorial), đúng
 * 1 lần duy nhất, ngay sau khi họ đã thắng ít nhất 1 màn campaign VÀ quay lại màn Home (xem
 * GameManager.checkTournamentActivation(), mở qua TournamentActivationPresentation). Trước khi
 * popup này hiện lên, bảng Weekly đứng yên hoàn toàn (LeaderboardManager.hasTournamentActivated()
 * == false — không đếm giờ, không tăng điểm bot).
 *
 * activateTournament() (bắt đầu đếm 7 ngày) chạy NGAY LÚC POPUP HIỆN LÊN (onShow()) — KHÔNG đợi
 * người chơi bấm nút xác nhận nữa. Nút xác nhận giờ chỉ đóng popup, không còn quyết định lúc nào
 * giải đấu bắt đầu tính giờ.
 */
@ccclass('TournamentActivationPopup')
export class TournamentActivationPopup extends UIPopup<void> {
    @property({ type: Button, tooltip: 'Nút xác nhận, ví dụ "Start"/"Let\'s go".' })
    btnStart: Button | null = null;

    @property({
        type: CountDownTimeEvent,
        tooltip:
            'Đếm ngược tới khi giải đấu (vừa kích hoạt ngay trong onShow() này) kết thúc — đọc ' +
            'THẬT từ LeaderboardManager.getTimeToNextWeek() SAU KHI activateTournament() đã chạy, ' +
            'nên luôn bắt đầu đúng ~24h (TOURNAMENT_DURATION_MS), không phải số cố định.',
    })
    countDownTimeNextWeek: CountDownTimeEvent | null = null;

    protected onEnable(): void {
        this.btnStart?.node.on(Constants.CLICK, this.onTouchStart, this);
    }

    protected onDisable(): void {
        this.btnStart?.node.off(Constants.CLICK, this.onTouchStart, this);
    }

    protected onShow(): void {
        // Không có bước tải nào — tắt loading NGAY (UIPopup.showLoading() tự bật lúc show()).
        this.hideLoading();
        const legacy = LegacyLeaderboardManager.instance;
        legacy?.activateTournament();

        if (this.countDownTimeNextWeek && legacy) {
            this.countDownTimeNextWeek.initCountDownTime(legacy.getTimeToNextWeek(), () => {});
        }
    }

    private onTouchStart(): void {
        this.requestClose();
    }
}
