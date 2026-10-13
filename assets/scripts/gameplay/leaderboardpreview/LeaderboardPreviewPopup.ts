import { _decorator, Button, Tween, UIOpacity, tween } from 'cc';
import { UIPopup } from '../../ui/UIPopup';
import { LeaderboardPreviewManager } from './LeaderboardPreviewManager';
import { LeaderboardPreviewSnapshot } from './LeaderboardPreviewPresentation';
import { LeaderboardManager as LegacyLeaderboardManager } from '../../leaderboard/LeaderboardManager';
import { CountDownTimeEvent } from '../../common/CountDownTimeEvent';
import { Constants } from '../../framework/constants';
import { UIManager } from '../../manager/UIManager';
const { ccclass, property } = _decorator;

const CONTINUE_FADE_IN_SECONDS = 0.25;


@ccclass('LeaderboardPreviewPopup')
export class LeaderboardPreviewPopup extends UIPopup<LeaderboardPreviewSnapshot> {
    @property(LeaderboardPreviewManager)
    manager: LeaderboardPreviewManager | null = null;

    @property({ type: CountDownTimeEvent, tooltip: 'Đếm ngược tới khi Weekly reset — dùng lại đúng component đang chạy ở tab Weekly thật.' })
    countDownTimeNextWeek: CountDownTimeEvent | null = null;

    @property(Button)
    btnContinue: Button | null = null;

    private continueEnabled = false;

    onEnable(): void {
        this.btnContinue?.node.on(Constants.CLICK, this.onTouchContinue, this);
    }

    onDisable(): void {
        this.btnContinue?.node.off(Constants.CLICK, this.onTouchContinue, this);
        // Phòng hờ: popup bị đóng ép (forceClose/closeAllPopups) NGAY GIỮA LÚC animation leo hạng
        // còn đang chạy — callback play() sẽ không bao giờ chạy tới để tự gỡ chặn, phải gỡ ở đây
        // tránh kẹt màn hình mãi mãi (không bấm được gì nữa).
        UIManager.instance.setBlockInput(false);
    }

    protected onShow(data: LeaderboardPreviewSnapshot): void {
        // "Đợi load xong mới cho mở, không thì vẫn dùng icon loading" (xác nhận từ user) — dữ liệu
        // bảng xếp hạng (bot/rank/top3) dựng ĐỒNG BỘ, nhưng avatar/frame của từng người tải BẤT
        // ĐỒNG BỘ riêng (lần đầu có thể chậm, chưa có cache) — loadingIcon (đã tự hiện sẵn từ
        // show()) giữ nguyên cho tới khi manager báo đã tải xong HẾT (whenAvatarsReady()), không
        // tắt ngay ở đây nữa.
        this.continueEnabled = false;
        if (this.btnContinue) {
            this.btnContinue.interactable = false;
            const opacity = this.btnContinue.node.getComponent(UIOpacity) ?? this.btnContinue.node.addComponent(UIOpacity);
            Tween.stopAllByTarget(opacity);
            opacity.opacity = 0;
        }

        if (this.countDownTimeNextWeek && LegacyLeaderboardManager.instance) {
            this.countDownTimeNextWeek.initCountDownTime(LegacyLeaderboardManager.instance.getTimeToNextWeek(), () => {});
        }

        if (!this.manager) {
            this.hideLoading();
            this.enableContinue();
            return;
        }

        // Chặn MỌI thao tác người chơi (chạm/vuốt bất kỳ đâu trên màn hình, kể cả tự cuộn tay
        // ScrollView đang được animation điều khiển, hay bấm hộp quà TOP3) suốt lúc hiệu ứng leo
        // hạng đang chạy — dùng CHUNG lớp chặn toàn màn hình (UIManager.setBlockInput) như các nơi
        // khác trong dự án, KHÔNG chỉ riêng nút Continue (vốn đã tự ẩn/disable sẵn, xem enableContinue()).
        UIManager.instance.setBlockInput(true);
        this.manager.play(data.oldScore, data.newScore, () => {
            UIManager.instance.setBlockInput(false);
            this.enableContinue();
        });
        // BUG đã sửa (báo lỗi của user — "iconLoading không tự tắt mà vẫn xoay mãi"): bỏ dòng
        // hideLoading() cũ nhưng QUÊN thêm lại chỗ gọi mới — loadingIcon không bao giờ được tắt nữa.
        // Tắt NGAY khi manager báo avatar/frame đã tải xong hết (độc lập với animation leo hạng ở
        // trên, KHÔNG đợi animation xong mới tắt).
        void this.manager.whenAvatarsReady().then(() => this.hideLoading());
    }

    /** Nút Continue ẨN (opacity 0) suốt lúc hiệu ứng leo hạng (manager.play) đang chạy — chỉ hiện
     * dần lên (mờ→đậm) SAU KHI hiệu ứng chạy xong, không hiện sẵn/mờ đục ngay từ đầu như trước. */
    private enableContinue(): void {
        this.continueEnabled = true;
        if (!this.btnContinue) return;

        this.btnContinue.interactable = true;
        const opacity = this.btnContinue.node.getComponent(UIOpacity) ?? this.btnContinue.node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        tween(opacity).to(CONTINUE_FADE_IN_SECONDS, { opacity: 255 }).start();
    }

    private onTouchContinue(): void {
        if (!this.continueEnabled) return;
        this.requestClose();
    }
}
