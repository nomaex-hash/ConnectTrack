import { _decorator, Node } from 'cc';
import { UIPopup } from '../UIPopup';
import { HeartsView } from '../widget/HeartsView';
import { AdServiceHolder } from '../../service/ads/AdServiceHolder';

const { ccclass, property } = _decorator;

/**
 * Popup thua RIÊNG của ConnectTracks (xác nhận từ user: thay thế hoàn toàn ResultPopup cho
 * ConnectTracks — ResultPopup/PUZZLE_FAILED_EVENT vẫn giữ nguyên cho Dogdoku, không đụng tới).
 * `onRevive`/`onRestart` do GameplayScreen cung cấp lúc openPopup — popup này KHÔNG tự biết gì về
 * GameSession/board, chỉ gọi lại đúng 2 callback đó (cùng pattern decoupling với ResultPopup's
 * onClosed).
 */
export interface ConnectTracksLoseData {
    /** Gọi SAU KHI xem quảng cáo THÀNH CÔNG — nơi gọi (GameplayScreen) tự dispatch 'revive' lên
     * đúng session đang mở, cộng lại mistake, giữ nguyên track đã đặt. */
    readonly onRevive: () => void;
    /** Gọi khi bấm "Chơi lại" — nơi gọi tự restart lại đúng level hiện tại từ đầu. */
    readonly onRestart: () => void;
}

@ccclass('ConnectTracksLosePopup')
export class ConnectTracksLosePopup extends UIPopup<ConnectTracksLoseData> {
    @property({
        type: HeartsView,
        tooltip:
            'Cụm 3 tim RIÊNG của popup này (HeartGroup, không phải heartsView của gameplay) — ' +
            'HeartsView component gắn trên node này, với emptyHeartSlots trỏ tới Heart/Heart-001/' +
            'Heart-002 có sẵn (xác nhận từ user). Popup tự phát lần lượt 3 anim vỡ khi hiện lên, ' +
            'không liên quan gì tới mistake thật đang đếm trong gameplay.',
    })
    private heartsView: HeartsView | null = null;

    @property({ min: 0, tooltip: 'Khoảng cách (giây) giữa lúc tim này vỡ và tim kế tiếp bắt đầu vỡ, lúc popup vừa mở.' })
    private heartBreakStagger = 0.3;

    @property({ type: Node, tooltip: 'Icon quảng cáo trên nút hồi sinh — hiện khi CÓ quảng cáo sẵn sàng (isRewardedReady()). Để trống thì bỏ qua.' })
    private reviveAdIcon: Node | null = null;

    private data: ConnectTracksLoseData | null = null;
    private adInProgress = false;

    protected onShow(data: ConnectTracksLoseData): void {
        this.data = data;
        this.hideLoading(); // Không có dữ liệu bất đồng bộ nào phải chờ.
        this.heartsView?.playAllBreaksSequentially(3, this.heartBreakStagger);
        this.refreshAdIcon();
    }

    private refreshAdIcon(): void {
        if (this.reviveAdIcon) this.reviveAdIcon.active = AdServiceHolder.current.isRewardedReady();
    }

    /** Nút "Xem quảng cáo để hồi sinh" — CÙNG pattern watchAdForConnectTracksPlaceTrack
     * (GameplayScreen): guard adInProgress, kiểm tra isRewardedReady(), showRewarded(), chỉ hành
     * động khi result.rewarded === true. Không requestClose() ngay — chỉ đóng SAU KHI thật sự nhận
     * thưởng, để lỡ quảng cáo thất bại/bị đóng sớm người chơi vẫn còn popup để bấm lại hoặc chọn
     * "Chơi lại" thay thế. */
    async onTapWatchAdToRevive(): Promise<void> {
        if (this.adInProgress) return;
        const ads = AdServiceHolder.current;
        if (!ads.isRewardedReady()) {
            console.log('[ConnectTracksLosePopup] Chưa có quảng cáo sẵn sàng.');
            return;
        }
        this.adInProgress = true;
        this.showLoading();
        try {
            const result = await ads.showRewarded();
            if (!result.rewarded) {
                console.log('[ConnectTracksLosePopup] Không nhận thưởng:', result.reason ?? 'đã đóng sớm');
                return;
            }
            this.data?.onRevive();
            this.requestClose();
        } finally {
            this.adInProgress = false;
            this.hideLoading();
            this.refreshAdIcon();
        }
    }

    /** Nút "Chơi lại" — đồng bộ, đóng popup ngay. */
    onTapRestart(): void {
        this.data?.onRestart();
        this.requestClose();
    }
}
