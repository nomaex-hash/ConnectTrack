import { _decorator, Component, EventTouch, Node, Rect } from 'cc';

const { ccclass } = _decorator;


@ccclass('TutorialInputGate')
export class TutorialInputGate extends Component {
    private readonly holes: Rect[] = [];

    onLoad(): void {
        const n = this.node;
        n.on(Node.EventType.TOUCH_START, this.onTouch, this);
        n.on(Node.EventType.TOUCH_MOVE, this.onTouch, this);
        n.on(Node.EventType.TOUCH_END, this.onTouch, this);
        n.on(Node.EventType.TOUCH_CANCEL, this.onTouch, this);
    }

    onDestroy(): void {
        this.node.targetOff(this);
    }

    setHoles(rects: readonly Rect[]): void {
        this.holes.length = 0;
        for (const r of rects) this.holes.push(r.clone());
    }

    private onTouch = (event: EventTouch): void => {
        const p = event.getUILocation();

        for (const hole of this.holes) {
            if (hole.contains(p)) {
                // Trong lỗ → thả xuống cho board (không nuốt) — board tự xử lý double-tap để đặt chó.
                event.preventSwallow = true;
                return;
            }
        }
    };
}
