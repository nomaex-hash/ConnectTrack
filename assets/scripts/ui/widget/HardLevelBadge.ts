import { _decorator, Component, Label, Tween, UIOpacity, Vec3, tween } from 'cc';
import { EventManager } from '../../core/EventManager';
import { ENCOURAGE_HIDDEN_EVENT, PUZZLE_READY_EVENT, PuzzleReadyEventPayload } from '../../event/PuzzleEvents';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';

const { ccclass, property } = _decorator;

const POP_IN_DURATION = 0.28;
const POP_FROM_SCALE = 0.6;
/** Chờ tối đa ENCOURAGE_HIDDEN_EVENT bao lâu trước khi tự hiện luôn (phòng RuleFrameIntro không có
 * trong scene, hoặc lỗi không bắn được sự kiện) — không để badge bị treo, không hiện được mãi. */
const ENCOURAGE_WAIT_FALLBACK_SECONDS = 6;

/**
 * Cụm "sprite lửa + label" báo hiệu LEVEL KHÓ — hiện lúc puzzle sẵn sàng (nếu payload.isHardLevel)
 * và GIỮ NGUYÊN trên màn suốt cả ván (khác với RuleFrameIntro.encourageNode, chỉ thoáng qua).
 * Tách riêng khỏi RuleFrameIntro để không biến nó thành component ôm nhiều việc.
 */
@ccclass('HardLevelBadge')
export class HardLevelBadge extends Component {
    @property({ tooltip: 'Label hiển thị chữ "Level khó" bên trong cụm badge.' })
    label: Label | null = null;

    private opacity: UIOpacity | null = null;
    /** true khi đang đợi RuleFrameIntro báo encourage đã ẩn hẳn mới được show(). */
    private pendingShow = false;

    onLoad(): void {
        this.opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        this.node.active = false;

        EventManager.instance.on<PuzzleReadyEventPayload>(PUZZLE_READY_EVENT, this.onPuzzleReady, this);
        EventManager.instance.on(ENCOURAGE_HIDDEN_EVENT, this.onEncourageHidden, this);
    }

    onDestroy(): void {
        EventManager.instance.targetOff(this);
        this.unschedule(this.onEncourageHidden);
        Tween.stopAllByTarget(this.node);
        if (this.opacity) Tween.stopAllByTarget(this.opacity);
    }

    private onPuzzleReady = (payload: PuzzleReadyEventPayload): void => {
        this.unschedule(this.onEncourageHidden);
        this.pendingShow = false;
        this.hide();

        if (!payload.isHardLevel) return;

        // Đợi bong bóng "encourage" (RuleFrameIntro) tắt hẳn mới hiện, tránh 2 hiệu ứng pop-in chồng
        // lúc encourage vừa hiện/vừa tắt. Có fallback phòng sự kiện không tới.
        this.pendingShow = true;
        this.scheduleOnce(this.onEncourageHidden, ENCOURAGE_WAIT_FALLBACK_SECONDS);
    };

    private onEncourageHidden = (): void => {
        if (!this.pendingShow) return;
        this.pendingShow = false;
        this.unschedule(this.onEncourageHidden);
        this.show();
    };

    private show(): void {
        if (this.label) this.label.string = Localization.get(L10N.gameplay.hardLevelBadge);

        Tween.stopAllByTarget(this.node);
        if (this.opacity) Tween.stopAllByTarget(this.opacity);

        this.node.active = true;
        this.node.setScale(POP_FROM_SCALE, POP_FROM_SCALE, 1);
        if (this.opacity) this.opacity.opacity = 0;

        tween(this.node).to(POP_IN_DURATION, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        if (this.opacity) {
            tween(this.opacity).to(POP_IN_DURATION, { opacity: 255 }).start();
        }
    }

    private hide(): void {
        Tween.stopAllByTarget(this.node);
        if (this.opacity) Tween.stopAllByTarget(this.opacity);
        this.node.active = false;
        this.node.setScale(1, 1, 1);
    }
}
