import { _decorator, Button, Component, Node, Tween, tween, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ButtonPressEffect')
export class ButtonPressEffect extends Component {
    @property({
        range: [0.5, 1, 0.01],
        slide: true,
        tooltip: 'Nút thu nhỏ còn bao nhiêu phần khi bị nhấn giữ.',
    })
    pressScale = 0.92;

    @property({ tooltip: 'Thời gian thu nhỏ (giây). Ngắn — phản hồi phải tức thì.' })
    pressDuration = 0.06;

    @property({ tooltip: 'Thời gian bung về (giây). Dài hơn một chút để kịp thấy nhịp nảy.' })
    releaseDuration = 0.12;


    private readonly baseScale = new Vec3(1, 1, 1);

    private readonly targetScale = new Vec3();

    private button: Button | null = null;


    private ownTween: Tween<Node> | null = null;

    onLoad(): void {
        this.button = this.getComponent(Button);

        if (this.button && this.button.transition === Button.Transition.SCALE) {

            this.button.transition = Button.Transition.NONE;
            console.warn(
                `[ButtonPressEffect] '${this.node.name}' đang để Button.Transition = SCALE. ` +
                    'Đã chuyển sang NONE — ButtonPressEffect là bên duy nhất điều khiển scale.',
            );
        }
    }

    onEnable(): void {
        this.baseScale.set(this.node.scale);

        this.node.on(Node.EventType.TOUCH_START, this.onPress, this);
        this.node.on(Node.EventType.TOUCH_END, this.onRelease, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onRelease, this);
    }

    onDisable(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onPress, this);
        this.node.off(Node.EventType.TOUCH_END, this.onRelease, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onRelease, this);

        this.ownTween?.stop();
        this.ownTween = null;
        this.node.setScale(this.baseScale);
    }

    private onPress(): void {
        if (this.button && !this.button.interactable) return;

        this.ownTween?.stop();
        this.targetScale.set(
            this.baseScale.x * this.pressScale,
            this.baseScale.y * this.pressScale,
            this.baseScale.z,
        );

        this.ownTween = tween(this.node)
            .to(this.pressDuration, { scale: this.targetScale }, { easing: 'quadOut' })
            .start();
    }

    private onRelease(): void {
        if (this.button && !this.button.interactable) return;

        this.ownTween?.stop();
        this.ownTween = tween(this.node)
            .to(this.releaseDuration, { scale: this.baseScale }, { easing: 'backOut' })
            .start();
    }
}
