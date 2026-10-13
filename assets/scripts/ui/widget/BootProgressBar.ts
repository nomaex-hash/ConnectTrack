import { _decorator, Component, Label, Sprite, Tween, UITransform, tween } from 'cc';
import { EventManager } from '../../core/EventManager';
import { BOOT_PROGRESS_EVENT, BootProgressEventPayload } from '../../event/AppEvents';

const { ccclass, property } = _decorator;


@ccclass('BootProgressBar')
export class BootProgressBar extends Component {
    @property({ type: Sprite, tooltip: 'Sprite phần ĐÃ CHẠY của thanh (node "progress").' })
    fill: Sprite | null = null;

    @property({ type: Label, tooltip: 'Nhãn phần trăm / mô tả bước. Có thể trống.' })
    label: Label | null = null;

    @property({
        tooltip: 'Mẫu chữ. {p} = phần trăm, {step} = tên bước đang chạy.',
    })
    labelFormat = 'Loading... {p}%';

    @property({ tooltip: 'Thời gian chạy mượt tới giá trị mới (giây). 0 = nhảy ngay.' })
    smoothSeconds = 0.35;

    @property({
        tooltip:
            'BẬT: giữa 2 mốc tiến độ THẬT (lúc đang chờ một bước nặng), thanh tự "trườn" ' +
            'chầm chậm thay vì đứng khựng — chỉ là ảo giác, không vượt quá mốc kế tiếp.',
    })
    creepEnabled = true;

    @property({ tooltip: 'Mỗi lần trườn cách nhau bao lâu (giây).' })
    creepIntervalSeconds = 0.35;

    @property({ tooltip: 'Mỗi lần trườn tăng thêm bao nhiêu (0..1, ví dụ 0.01 = 1%).' })
    creepStep = 0.01;

    @property({
        tooltip: 'Trườn tối đa vượt qua mốc thật gần nhất bao nhiêu (0..1) — không bao giờ vượt quá.',
    })
    creepAheadCap = 0.06;

    private fullWidth = 0;
    private transform: UITransform | null = null;
    private tweenTarget: { value: number } | null = null;
    private lastReportedTarget = 0;

    onLoad(): void {
        this.transform = this.fill?.node.getComponent(UITransform) ?? null;
        this.fullWidth = this.transform?.width ?? 0;

        EventManager.instance.on<BootProgressEventPayload>(
            BOOT_PROGRESS_EVENT,
            this.onProgress,
            this,
        );

        if (this.creepEnabled) this.schedule(this.creepTick, this.creepIntervalSeconds);

        this.apply(0);
        this.updateLabel(0, '');
    }

    onDestroy(): void {
        EventManager.instance.targetOff(this);
        this.unschedule(this.creepTick);
        this.stopTween();
    }

    private onProgress = (payload: BootProgressEventPayload): void => {
        const value = Math.max(0, Math.min(1, payload.progress));
        this.lastReportedTarget = value;

        this.updateLabel(value, payload.step ?? '');

        if (this.smoothSeconds <= 0) {
            this.apply(value);
            return;
        }
        this.animateTo(value);
    };

    /** Trườn nhẹ về phía mốc kế tiếp trong lúc chờ, không bao giờ vượt trần cho phép. */
    private creepTick = (): void => {
        const ceiling = Math.min(this.lastReportedTarget + this.creepAheadCap, 0.98);
        const next = Math.min(this.currentValue() + this.creepStep, ceiling);
        if (next > this.currentValue()) this.apply(next);
    };

    private animateTo(target: number): void {
        this.stopTween();

        const from = { value: this.currentValue() };
        this.tweenTarget = from;

        tween(from)
            .to(this.smoothSeconds, { value: target }, { easing: 'quadOut', onUpdate: () => this.apply(from.value) })
            .start();
    }

    private currentValue(): number {
        if (this.isFilled()) return this.fill?.fillRange ?? 0;
        if (this.fullWidth <= 0 || !this.transform) return 0;
        return this.transform.width / this.fullWidth;
    }

    private apply(value: number): void {
        if (this.isFilled()) {
            this.fill!.fillRange = value;
            return;
        }
        if (this.transform && this.fullWidth > 0) {
            this.transform.width = this.fullWidth * value;
        }
    }

    private isFilled(): boolean {
        return this.fill?.type === Sprite.Type.FILLED;
    }

    private updateLabel(value: number, step: string): void {
        if (!this.label) return;

        this.label.string = this.labelFormat
            .replace('{p}', `${Math.round(value * 100)}`)
            .replace('{step}', step);
    }

    private stopTween(): void {
        if (this.tweenTarget) Tween.stopAllByTarget(this.tweenTarget);
        this.tweenTarget = null;
    }
}
