import { _decorator, Component, Label } from 'cc';
import { msUntilEndOfDay } from '../../utility/DateUtil';
import { formatCountdown } from '../../utility/TimeFormat';

const { ccclass, property } = _decorator;

const TICK_SECONDS = 1;


@ccclass('CountdownLabel')
export class CountdownLabel extends Component {
    @property({ type: Label, tooltip: 'Nhãn hiển thị đếm ngược. Trống thì dùng Label trên node này.' })
    label: Label | null = null;

    onEnable(): void {
        this.resolveLabel();
        this.tick();
        this.schedule(this.tick, TICK_SECONDS);
    }

    onDisable(): void {
        this.unschedule(this.tick);
    }

    private resolveLabel(): void {
        if (!this.label) this.label = this.getComponent(Label);
    }

    private tick = (): void => {
        if (this.label) this.label.string = formatCountdown(msUntilEndOfDay());
    };
}
