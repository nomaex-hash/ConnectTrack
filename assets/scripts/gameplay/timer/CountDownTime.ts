import { _decorator, Component, Label } from 'cc';
import { formatClock } from '../../utility/TimeFormat';

const { ccclass, property } = _decorator;

const TICK_SECONDS = 1;


@ccclass('CountDownTime')
export class CountDownTime extends Component {
    @property(Label)
    txtCountDownTime: Label | null = null;

    @property({ type: Label, tooltip: 'Label đổ bóng phía sau (nếu có) — luôn hiện cùng nội dung với txtCountDownTime.' })
    txtCountDownTimeShadow: Label | null = null;

    private countTime = 0;
    private onFinished: (() => void) | null = null;

    initTime(timeSeconds: number): void {
        this.countTime = timeSeconds;
        this.updateLabel();
    }

    initCountDownTime(timeSeconds: number, onFinished: (() => void) | null): void {
        this.onFinished = onFinished;
        this.countTime = timeSeconds;
        this.updateLabel();

        this.unschedule(this.tick);
        this.schedule(this.tick, TICK_SECONDS);
        this.node.active = true;
    }

    protected onDisable(): void {
        this.unschedule(this.tick);
    }

    private tick = (): void => {
        this.countTime--;

        if (this.countTime > 0) {
            this.updateLabel();
            return;
        }

        this.countTime = 0;
        this.updateLabel();
        this.unschedule(this.tick);
        this.onFinished?.();
    };

    private updateLabel(): void {
        const text = formatClock(this.countTime);
        if (this.txtCountDownTime) this.txtCountDownTime.string = text;
        if (this.txtCountDownTimeShadow) this.txtCountDownTimeShadow.string = text;
    }
}
