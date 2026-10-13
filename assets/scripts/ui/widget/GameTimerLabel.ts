import { _decorator, Component, Label, Layout, Node } from 'cc';
import { EventManager } from '../../core/EventManager';
import {
    PUZZLE_FAILED_EVENT,
    PUZZLE_READY_EVENT,
    PUZZLE_SOLVED_EVENT,
    PuzzleReadyEventPayload,
} from '../../event/PuzzleEvents';
import { PuzzleSessionHolder } from '../../gameplay/PuzzleSessionHolder';
import { formatElapsed } from '../../utility/TimeFormat';

const { ccclass, property } = _decorator;

const TICK_SECONDS = 0.2;


@ccclass('GameTimerLabel')
export class GameTimerLabel extends Component {
    @property({ type: Label, tooltip: 'Nhãn hiển thị thời gian. Trống thì dùng Label trên node này.' })
    label: Label | null = null;

    @property({
        type: Node,
        tooltip: 'Nhóm bật/tắt theo context (ví dụ khung đồng hồ). Trống thì bật/tắt node này.',
    })
    container: Node | null = null;

    @property({
        type: Layout,
        tooltip:
            'Layout HÀNG NGANG chứa cụm HUD (chó/đồng hồ/tim). Khi ẩn đồng hồ ở campaign, ' +
            'Layout tự co và căn giữa lại các node còn lại. Trống thì bỏ qua.',
    })
    rowLayout: Layout | null = null;

    onLoad(): void {
        if (!this.label) this.label = this.getComponent(Label);

        const bus = EventManager.instance;
        bus.on<PuzzleReadyEventPayload>(PUZZLE_READY_EVENT, this.onReady, this);
        bus.on(PUZZLE_SOLVED_EVENT, this.onEnd, this);
        bus.on(PUZZLE_FAILED_EVENT, this.onEnd, this);

        this.setVisible(false);
    }

    onDestroy(): void {
        EventManager.instance.targetOff(this);
        this.unschedule(this.tick);
    }

    private onReady = (payload: PuzzleReadyEventPayload): void => {
        const isDaily = payload.context === 'daily';
        this.setVisible(isDaily);

        this.unschedule(this.tick);
        if (isDaily) {
            this.tick();
            this.schedule(this.tick, TICK_SECONDS);
        }
    };

    private onEnd = (): void => {
        this.tick();
        this.unschedule(this.tick);
    };

    private tick = (): void => {
        const seconds = PuzzleSessionHolder.current?.elapsedSeconds ?? 0;
        if (this.label) this.label.string = formatElapsed(seconds);
    };

    private setVisible(visible: boolean): void {
        const node = this.container ?? this.node;
        node.active = visible;

        this.rowLayout?.updateLayout(true);
    }
}
