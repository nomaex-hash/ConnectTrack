import { _decorator, Animation, Component, Label, Node, Tween } from 'cc';
import { StreakDay } from '../../model/StreakBoard';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';
import { playFrameAnimation } from '../../animation/FrameAnimUtil';
import { AudioManager } from '../../manager/AudioManager';

const { ccclass, property } = _decorator;

/** Key tên thứ theo Date.getDay(): 0 = Chủ nhật. */
const WEEKDAY_KEYS: readonly string[] = [
    L10N.weekday.sun,
    L10N.weekday.mon,
    L10N.weekday.tue,
    L10N.weekday.wed,
    L10N.weekday.thu,
    L10N.weekday.fri,
    L10N.weekday.sat,
];


export interface StreakRewardInfo {

    readonly ready: boolean;

    readonly claimed: boolean;

    readonly onClaim: () => void;
}


@ccclass('StreakDayCell')
export class StreakDayCell extends Component {
    @property({ type: Label, tooltip: 'Nhãn thứ (CN, T2, ...).' })
    weekdayLabel: Label | null = null;

    @property({ type: Node, tooltip: 'Vòng tròn trống — ngày chưa có chuỗi.' })
    emptyNode: Node | null = null;

    @property({ type: Node, tooltip: 'Dấu tích — ngày đã có chuỗi.' })
    checkedNode: Node | null = null;

    @property({
        type: Node,
        tooltip: 'Hộp quà — chỉ ở ô CUỐI. LUÔN hiện; đổi ảnh đóng/mở tĩnh, chạy 1 trong 3 node animation Idle/Gift/Open.',
    })
    rewardNode: Node | null = null;

    @property({
        type: Animation,
        tooltip:
            'Node/prefab RIÊNG chứa animation Idle — LUÔN là node hiện mặc định lúc CHƯA tới ' +
            'ngày cuối (đứng yên ở khung hình cuối sau khi chạy xong, không ẩn đi). Bấm vào thì ' +
            'chạy lại từ đầu. Không còn dùng sprite hộp đóng riêng nữa.',
    })
    idleAnimation: Animation | null = null;

    @property({
        type: Animation,
        tooltip:
            'Node/prefab RIÊNG chứa animation Gift — tự động chạy LOOP ngay khi vừa tới ngày ' +
            'cuối (sẵn sàng nhận quà), KHÔNG cần bấm. Loop trong giftLoopSeconds rồi tự chuyển ' +
            'sang Open.',
    })
    giftAnimation: Animation | null = null;

    @property({
        tooltip:
            'Trễ bao lâu (giây) SAU KHI cell thực sự hiện ra rồi mới bắt đầu chạy Gift loop — ' +
            'để khớp nhịp với các node khác đang mờ dần hiện lên (vd nút bấm ở màn Streak).',
    })
    giftStartDelaySeconds = 0.5;

    @property({ tooltip: 'Gift loop bao lâu (giây) trước khi tự chuyển sang Open.' })
    giftLoopSeconds = 3;

    @property({
        type: Animation,
        tooltip:
            'Node/prefab RIÊNG chứa animation Open — hộp quà tự mở SAU KHI Gift loop xong. Chạy ' +
            'xong node này mới THẬT SỰ nhận quà (cộng lượt Place Dog).',
    })
    openAnimation: Animation | null = null;

    @property({
        tooltip: 'Open chạy xong: đợi thêm bao lâu (giây) rồi mới thật sự nhận quà / mở popup Reward.',
    })
    openToRewardDelaySeconds = 0.3;

    private claimed = false;
    private claimable = false;
    private opening = false;
    private pendingGiftStart = false;
    private onClaim: (() => void) | null = null;

    onLoad(): void {
        // Phát âm click lúc CHẠM XUỐNG (giống ButtonSfx của các nút khác) — không dùng chung
        // thời điểm với onTapReward (TOUCH_END) vì tap trên hộp quà cũng cần cảm giác bấm nút
        // ngay lập tức, phát bất kể tap có dẫn tới hành động gì hay không.
        this.rewardNode?.on(Node.EventType.TOUCH_START, this.onTouchStartReward, this);
        this.rewardNode?.on(Node.EventType.TOUCH_END, this.onTapReward, this);
        this.openAnimation?.on(Animation.EventType.FINISHED, this.onOpenFinished, this);
    }

    /**
     * DailyStreakScreen ẨN HẲN contentNode (chứa dayRow, tức chứa cả cell này) trong lúc chạy
     * hiệu ứng "thắp chuỗi" tự động (enterCelebrateMode), NGAY SAU KHI buildDayRow()/bind() đã
     * kịp khởi động Gift loop — khiến Gift chạy trong lúc bị ẩn, không bao giờ thấy được. Bù
     * lại bằng cách tự thử khởi động lại mỗi khi cell THỰC SỰ hiện ra (onEnable ăn theo cả
     * trường hợp ancestor bật active, không chỉ chính node này).
     */
    onEnable(): void {
        this.tryStartGiftLoop();
    }

    onDestroy(): void {
        this.unschedule(this.playGiftLoop);
        this.unschedule(this.playOpenAnimation);
        this.unschedule(this.claimAfterDelay);

        if (this.rewardNode?.isValid) {
            this.rewardNode.off(Node.EventType.TOUCH_START, this.onTouchStartReward, this);
            this.rewardNode.off(Node.EventType.TOUCH_END, this.onTapReward, this);
            Tween.stopAllByTarget(this.rewardNode);
        }
        if (this.openAnimation?.isValid) this.openAnimation.off(Animation.EventType.FINISHED, this.onOpenFinished, this);
    }

    bind(day: StreakDay, reward?: StreakRewardInfo): void {
        if (this.weekdayLabel) {
            const key = WEEKDAY_KEYS[day.weekday];
            this.weekdayLabel.string = key ? Localization.get(key) : '';
        }

        if (day.isReward) {
            this.bindReward(reward);
        } else {
            this.bindNormal(day);
        }
    }


    private bindNormal(day: StreakDay): void {
        this.claimed = false;
        this.claimable = false;
        this.opening = false;
        this.pendingGiftStart = false;
        this.onClaim = null;

        if (this.rewardNode) this.rewardNode.active = false;
        if (this.checkedNode) this.checkedNode.active = day.checked;
        if (this.emptyNode) this.emptyNode.active = !day.checked;
    }


    private bindReward(reward: StreakRewardInfo | undefined): void {
        this.claimed = reward?.claimed ?? false;
        this.claimable = (reward?.ready ?? false) && !this.claimed;
        this.onClaim = reward?.onClaim ?? null;

        if (this.claimed) {
            // Đã nhận quà — hiện y hệt 1 ngày ĐÃ CHECK bình thường (giống các ô còn lại), không
            // còn hiện hộp quà nữa.
            this.opening = false;
            this.pendingGiftStart = false;
            this.showCheckedAsClaimed();
            return;
        }

        if (this.checkedNode) this.checkedNode.active = false;
        if (this.emptyNode) this.emptyNode.active = false;
        if (this.rewardNode) this.rewardNode.active = true;
        this.showIdleRestState();

        if (!this.claimable) {
            this.unschedule(this.playGiftLoop);
            this.unschedule(this.playOpenAnimation);
            this.unschedule(this.claimAfterDelay);
            this.opening = false;
            this.pendingGiftStart = false;
            return;
        }

        // Đã tới ngày cuối (sẵn sàng nhận) — TỰ ĐỘNG chạy Gift(loop) → Open → nhận quà, KHÔNG
        // cần bấm. bind() có thể gọi lại (vd nút reset streak để test) trong lúc đang chạy dở —
        // chỉ khởi động chuỗi 1 LẦN, tránh animation chồng lên nhau.
        if (this.opening) return;
        this.pendingGiftStart = true;
        this.tryStartGiftLoop();
    }

    /** Chỉ thực sự bắt đầu Gift loop khi cell đang HIỂN THỊ THẬT SỰ (activeInHierarchy) — nếu
     * gọi lúc contentNode/ancestor còn ẩn thì hoãn lại, onEnable() sẽ tự gọi lại lúc hiện ra.
     * Sau đó còn đợi thêm giftStartDelaySeconds để khớp nhịp với các node khác đang hiện lên. */
    private tryStartGiftLoop(): void {
        if (!this.pendingGiftStart || this.opening) return;
        if (!this.node.activeInHierarchy) return;

        this.pendingGiftStart = false;
        this.opening = true;
        this.unschedule(this.playGiftLoop);
        this.scheduleOnce(this.playGiftLoop, this.giftStartDelaySeconds);
    }

    private onTouchStartReward = (): void => {
        AudioManager.maybeInstance?.playButtonClick();
    };

    private onTapReward(): void {
        if (this.claimed || this.claimable || this.opening) return;

        // Chưa tới ngày cuối — bấm chỉ là phản hồi, không nhận được gì.
        this.playAnimNode(this.idleAnimation, false);
    }

    private playGiftLoop = (): void => {
        this.playAnimNode(this.giftAnimation, true);
        this.unschedule(this.playOpenAnimation);
        this.scheduleOnce(this.playOpenAnimation, this.giftLoopSeconds);
    };

    private playOpenAnimation = (): void => {
        const animation = this.playAnimNode(this.openAnimation, false);
        if (!animation) this.onRewardSequenceFinished();
    };

    private onOpenFinished = (): void => {
        this.onRewardSequenceFinished();
    };

    private onRewardSequenceFinished(): void {
        if (!this.opening) return;

        this.opening = false;
        this.unschedule(this.playOpenAnimation);
        this.unschedule(this.claimAfterDelay);
        this.scheduleOnce(this.claimAfterDelay, this.openToRewardDelaySeconds);
    }

    private claimAfterDelay = (): void => {
        this.claimed = true;
        this.showCheckedAsClaimed();
        this.onClaim?.();
    };

    /** Nhận quà xong — chuyển hẳn sang hiện checkedNode (giống ô đã check bình thường), tắt hộp quà. */
    private showCheckedAsClaimed(): void {
        this.setVisibleNode(null);
        if (this.rewardNode) this.rewardNode.active = false;
        if (this.checkedNode) this.checkedNode.active = true;
        if (this.emptyNode) this.emptyNode.active = false;
    }

    /** Bật node animation được chỉ định, TẮT 2 node còn lại — chỉ 1 node hiện tại 1 thời điểm. */
    private playAnimNode(animation: Animation | null, loop: boolean): Animation | null {
        this.setVisibleNode(animation?.node ?? null);
        return playFrameAnimation(animation?.node ?? null, loop);
    }

    /** Chỉ 1 trong 3 node (Idle/Gift/Open) được active tại 1 thời điểm. */
    private setVisibleNode(node: Node | null): void {
        if (this.idleAnimation?.node) this.idleAnimation.node.active = this.idleAnimation.node === node;
        if (this.giftAnimation?.node) this.giftAnimation.node.active = this.giftAnimation.node === node;
        if (this.openAnimation?.node) this.openAnimation.node.active = this.openAnimation.node === node;
    }

    /** Trạng thái nghỉ (chưa sẵn sàng nhận): hiện node Idle — Animation chưa từng play() thì
     * Sprite chưa có khung hình nào để hiện (trống), nên vẫn cần phát 1 lần ở đây (không phải
     * chỉ setVisibleNode) để có hình ngay từ lúc bind(), không cần đợi người chơi bấm mới thấy. */
    private showIdleRestState(): void {
        if (this.idleAnimation?.node?.active) return;
        this.playAnimNode(this.idleAnimation, false);
    }
}
