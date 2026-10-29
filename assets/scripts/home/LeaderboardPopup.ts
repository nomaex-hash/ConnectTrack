import { _decorator, Button, Color, Graphics, Label, Node, UITransform, Widget } from 'cc';
import { UIPopup } from '../ui/UIPopup';
import { Constants } from '../framework/constants';
import { LeaderboardTabGroupManager } from './LeaderboardTabGroupManager';
import { LeaderboardManager as LegacyLeaderboardManager } from '../leaderboard/LeaderboardManager';
import { PopupId } from '../ui/PopupId';
import { TournamentResultSnapshot } from '../gameplay/tournament/TournamentPresentation';
import { GameManager } from '../manager/GameManager';
import { AppState } from '../core/AppState';
import { EventManager } from '../core/EventManager';
import { LEVEL_SELECTED_EVENT, LevelSelectedEventPayload } from '../event/AppEvents';
import { ProgressionHolder } from '../gameplay/progression/ProgressionHolder';
const { ccclass, property } = _decorator;

/**
 * Bọc LeaderboardTabGroupManager (trước đây là 1 trong 3 "trang" của tab carousel Shop/Home/
 * Leaderboard trong HomeTabGroupManager) thành 1 popup nổi đè lên Main Menu — mở trực tiếp từ nút
 * Leaderboard (MainMenuScreen.onTapLeaderboard), KHÔNG còn qua cơ chế chuyển tab nữa. Bên trong
 * LeaderboardTabGroupManager giờ chỉ còn hiện tab Weekly (không còn Global) — xem ghi chú Editor
 * ở LeaderboardTabGroup.prefab.
 */
@ccclass('LeaderboardPopup')
export class LeaderboardPopup extends UIPopup<void> {
    @property({
        type: LeaderboardTabGroupManager,
        tooltip: 'Component nội dung Leaderboard (LeaderboardTabGroup.prefab, đặt làm con popup này).',
    })
    leaderboardGroup: LeaderboardTabGroupManager | null = null;

    @property({ type: Button, tooltip: 'Nút đóng popup (X/back).' })
    btnClose: Button | null = null;

    @property({ tooltip: 'Hiện nút test tua thêm 1 giờ trên Leaderboard.' })
    showTimeTestButton = true;

    private timeTestButton: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Banner "Đến nhận" — LUÔN hiện (không ẩn nữa), 2 trạng thái tuỳ có phần thưởng Top 3 ' +
            'chờ nhận hay không (xem hasPendingClaim()/refreshRewardBanner()): CÓ (giải đấu vừa hết ' +
            'giờ, lọt Top 3, chưa nhận) → chữ "Go to collect", bấm vào mở luồng nhận thưởng. KHÔNG ' +
            '(giải đấu đang diễn ra bình thường, đã nhận xong, hoặc không lọt Top 3) → chữ ' +
            '"Play now", bấm vào vào thẳng màn chơi hiện tại (giống nút "Chơi" ở Main Menu). Bình ' +
            'thường không cần chủ động bấm để nhận thưởng — popup tự mở ngay khi giải đấu hết giờ ' +
            '(LeaderboardTabGroupManager.showInfo()) hoặc ngay khi thắng màn/quay lại Home/mở app ' +
            '(GameManager.checkPendingTournamentResult()); banner này chỉ là lối vào dự phòng.',
    })
    rewardBanner: Node | null = null;

    @property({ type: Button, tooltip: 'Nút bấm trên banner (thường là chính banner, hoặc 1 nút con trong đó).' })
    btnCollect: Button | null = null;

    @property({ type: Label, tooltip: 'Label chữ trên banner — script tự đổi "Go to collect" <-> "Play now".' })
    rewardBannerLabel: Label | null = null;

    /** true SAU KHI đã bấm Collect và luồng nhận thưởng (RewardTop3 -> RewardReceivePopup) đã
     * đóng hoàn toàn (xem onTouchCollect() — set trong onClosed của openPopup(TournamentResult)).
     * Chỉ có ý nghĩa trong PHIÊN mở Leaderboard hiện tại — reset về false mỗi lần onShow() (đóng
     * hẳn Leaderboard rồi mở lại) để không "Play now" mãi mãi ở những lần ghé thăm sau, không có
     * gì để nhận nữa. */
    private justClaimedTop3 = false;

    protected onEnable(): void {
        this.btnClose?.node.on(Constants.CLICK, this.onTouchClose, this);
        this.btnCollect?.node.on(Constants.CLICK, this.onTouchCollect, this);
    }

    protected onDisable(): void {
        this.btnClose?.node.off(Constants.CLICK, this.onTouchClose, this);
        this.btnCollect?.node.off(Constants.CLICK, this.onTouchCollect, this);
    }

    protected onShow(): void {
        // "Điều kiện để mở leaderboard là khi avatar và frame đã tải xong và ổn định rồi thì mới
        // mở" (xác nhận từ user) — KHÔNG tắt loadingIcon ngay nữa (dòng cũ hideLoading() ở đây sai:
        // avatar/frame tải bất đồng bộ, popup PHẢI đợi). Giữ loadingIcon (đã tự hiện sẵn từ
        // UIPopup.show()) cho tới khi leaderboardGroup báo rank list + avatar/frame đã sẵn sàng.
        this.justClaimedTop3 = false;
        this.leaderboardGroup?.setShow();
        this.leaderboardGroup?.showGroup();
        this.refreshRewardBanner();
        this.ensureTimeTestButton();
        // BUG đã sửa (báo lỗi của user — "icon loading vẫn tắt quá sớm"): whenLeaderboardReady()
        // (Promise) luôn trễ thêm ít nhất 1 microtask so với lúc nodeLoading thật sự tắt bên trong
        // LeaderboardGroupWeek — đổi sang onLeaderboardReady() (callback đồng bộ, chạy CÙNG lệnh).
        // LOG TẠM ĐỂ DEBUG (báo lỗi của user — "icon tắt quá nhanh, leaderboard còn chưa hiện") —
        // xoá sau khi xác định được nguyên nhân thật từ log console thực tế.
        this.leaderboardGroup?.onLeaderboardReady(() => {
            this.hideLoading();
        });
    }

    protected onHide(): void {
        this.leaderboardGroup?.setHide();
    }

    private ensureTimeTestButton(): void {
        if (!this.timeTestButton && this.showTimeTestButton) {
            const node = new Node('TestAdvanceOneHour');
            node.layer = this.node.layer;
            node.parent = this.node;
            node.addComponent(UITransform).setContentSize(160, 44);
            const background = node.addComponent(Graphics);
            background.fillColor = new Color(35, 115, 65, 255);
            background.roundRect(-80, -22, 160, 44, 10);
            background.fill();
            node.addComponent(Button);
            const widget = node.addComponent(Widget);
            widget.isAlignTop = true;
            widget.isAlignLeft = true;
            widget.top = 24;
            widget.left = 24;
            const text = new Node('Label');
            text.layer = node.layer;
            text.parent = node;
            text.addComponent(UITransform).setContentSize(154, 40);
            const label = text.addComponent(Label);
            label.string = 'Test +1 giờ';
            label.fontSize = 22;
            label.lineHeight = 28;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            node.on(Button.EventType.CLICK, this.onTestAdvanceOneHour, this);
            this.timeTestButton = node;
        }
        if (this.timeTestButton) {
            this.timeTestButton.active = this.showTimeTestButton;
            this.timeTestButton.setSiblingIndex(-1);
        }
    }

    private onTestAdvanceOneHour(): void {
        const manager = LegacyLeaderboardManager.instance;
        if (!manager) return;
        manager.fastForwardOfflineGrowthForTesting(1);
        this.leaderboardGroup?.showLeaderboardGroup();
        this.leaderboardGroup?.showInfo();
        this.refreshRewardBanner();
    }

    /** true khi ĐANG THẬT SỰ có phần thưởng Top 3 chưa nhận (giải đấu vừa kết thúc) — CHỈ lúc này
     * banner mới có ý nghĩa "Go to collect". justClaimedTop3 loại trừ luôn cả TH vừa nhận xong
     * trong phiên mở Leaderboard này (đã nhận rồi thì không còn gì để nhận nữa dù hasPendingTournamentResult()
     * lỡ chưa kịp cập nhật). */
    private hasPendingClaim(): boolean {
        if (this.justClaimedTop3) return false;
        const legacy = LegacyLeaderboardManager.instance;
        const rank = legacy?.hasPendingTournamentResult() ? legacy.getPendingTournamentRank() : 0;
        return rank >= 1 && rank <= 3;
    }

    /** Banner LUÔN hiện (không còn ẩn khi giải đấu đang diễn ra bình thường — trước đây ẩn hẳn,
     * đúng bug đã báo "banner biến mất") — chỉ đổi CHỮ + HÀNH VI khi bấm tuỳ có phần thưởng chờ
     * nhận hay không (xem onTouchCollect()). */
    private refreshRewardBanner(): void {
        if (!this.rewardBanner) return;

        this.rewardBanner.active = true;
        if (this.rewardBannerLabel) {
            this.rewardBannerLabel.string = this.hasPendingClaim() ? 'Go to collect' : 'Play now';
        }
    }

    private onTouchCollect(): void {
        // KHÔNG có phần thưởng chờ nhận (đã nhận xong trong phiên này, giải đấu đang diễn ra bình
        // thường, hoặc không lọt Top 3) — bấm vào thẳng màn chơi hiện tại, y hệt MainMenuScreen.
        // onTapPlay(). Đây giờ là hành vi MẶC ĐỊNH của banner, không còn ẩn banner đi nữa.
        if (!this.hasPendingClaim()) {
            const levelId = ProgressionHolder.current?.getCurrentLevel();
            if (levelId == null) return;
            const payload: LevelSelectedEventPayload = { context: 'campaign', levelId };
            EventManager.instance.emit(LEVEL_SELECTED_EVENT, payload);
            return;
        }

        // Phòng vệ giống hệt UIManager.maybeOpenTournamentResult() (nhánh ngoài Top 3) — luồng
        // nhận thưởng TUYỆT ĐỐI không được kích hoạt/hiện khi đang Gameplay. Bình thường không thể
        // xảy ra (Leaderboard chỉ mở được từ nút trên Main Menu, xem MainMenuScreen.onTapLeaderboard),
        // nhưng chặn tường minh ở đây để không phụ thuộc mãi vào việc "chỉ có 1 chỗ mở nó".
        if (GameManager.instance?.state !== AppState.MainMenu) return;

        const legacy = LegacyLeaderboardManager.instance;
        const rank = legacy!.getPendingTournamentRank();

        // TournamentResultPopup đóng HOÀN TOÀN (RewardReceivePopup đã đóng, kho đã cộng thưởng —
        // xem GameManager.claimTournamentReward()/TournamentResultPopup.onTouchCollect) → mở NGAY
        // popup "New Session" (PopupId.TournamentReset) — popup ĐÓ mới thật sự chốt sổ/kích hoạt
        // giải đấu mới. Đợi CẢ 2 popup đóng xong hết mới đổi banner sang "Play now" — không mở "New
        // Session" song song với TournamentResultPopup lúc nó còn đang chạy animation đóng.
        this.popups?.openPopup<TournamentResultSnapshot>(PopupId.TournamentResult, { rank }, () => {
            this.popups?.openPopup<void>(PopupId.TournamentReset, undefined as never, () => {
                this.justClaimedTop3 = true;
                this.refreshRewardBanner();
            });
        });
    }

    private onTouchClose(): void {
        this.requestClose();
    }
}
