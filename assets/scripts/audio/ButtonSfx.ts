import { _decorator, Button, Component, Node } from 'cc';
import { AudioManager } from '../manager/AudioManager';

const { ccclass } = _decorator;


@ccclass('ButtonSfx')
export class ButtonSfx extends Component {
    private button: Button | null = null;

    onLoad(): void {
        this.button = this.getComponent(Button);
    }

    onEnable(): void {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onDisable(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    // Phát NGAY lúc chạm xuống thay vì đợi Button tự phát 'click' lúc thả tay — Button chạy
    // clickEvents (vd đổi màn hình) TRƯỚC khi tự emit 'click' (xem cocos/ui/button.ts), nên
    // nút nào có click handler đổi state ĐỒNG BỘ (Node.destroy() tắt active ngay lập tức) sẽ
    // tự gỡ listener 'click' của component này trước khi kịp nhận — mất tiếng. Chạm xuống thì
    // không có handler nào kịp chạy trước, luôn an toàn.
    private onTouchStart = (): void => {
        if (this.button && !this.button.interactable) return;
        AudioManager.maybeInstance?.playButtonClick();
    };
}
