import { _decorator, Component, Button, Node, tween, Vec3, Tween } from 'cc';
import { AudioManager } from '../manager/AudioManager';

const { ccclass, property, requireComponent, disallowMultiple } = _decorator;

/**
 * Component gắn lên các nút bấm chung: phát âm click, chặn double-tap, tuỳ chọn scale nhấp nháy
 * chờ (idle). Adapt từ Reference/BtnAdapter.ts — bỏ AudioManager2/SOUND_NAME theo tên clip, dùng
 * thẳng AudioManager.instance.playButtonClick() (Dogdoku chỉ có 1 clip click, không tra theo tên).
 */
@ccclass('ButtonClickEffect')
@requireComponent(Button)
@disallowMultiple
export class ButtonClickEffect extends Component {
    @property({ tooltip: 'Phát âm click khi bấm.' })
    isPlaySound = true;

    /** Giữ lại cho khớp field cũ trong prefab — Dogdoku chỉ có 1 clip click, không dùng tên này để tra. */
    @property({ tooltip: '(Không dùng — AudioManager chỉ có 1 clip click cố định.)' })
    clickSoundName = 'click';

    @property({ tooltip: 'Chặn bấm nhanh 2 lần liên tiếp.' })
    isPreventSecondClick = true;

    @property({ tooltip: 'Bấm xong bao lâu mới bấm lại được — chỉ áp dụng khi isPreventSecondClick.' })
    preventTime = 0.2;

    @property({ tooltip: 'Bật hiệu ứng scale nhấp nháy chờ (idle breathing).' })
    isIdleScale = false;

    private idleTween: Tween<Node> | null = null;

    protected onEnable(): void {
        const button = this.getComponent(Button);
        button?.node.on('click', this.onClick, this);

        if (this.isIdleScale) this.startIdleTween();
    }

    protected onDisable(): void {
        const button = this.getComponent(Button);
        button?.node.off('click', this.onClick, this);
        this.stopIdleTween();
    }

    private onClick = (): void => {
        const button = this.getComponent(Button);
        if (this.isPreventSecondClick && button) {
            button.interactable = false;
            this.scheduleOnce(() => {
                if (button.node?.isValid) button.interactable = true;
            }, this.preventTime);
        }

        if (this.isPlaySound) AudioManager.maybeInstance?.playButtonClick();
    };

    private startIdleTween(): void {
        this.idleTween = tween(this.node)
            .repeatForever(
                tween<Node>()
                    .to(1, { scale: new Vec3(1.1, 1.1, 1) }, { easing: 'sineOut' })
                    .to(1, { scale: new Vec3(1, 1, 1) }, { easing: 'sineIn' }),
            )
            .start();
    }

    private stopIdleTween(): void {
        this.idleTween?.stop();
        this.idleTween = null;
        Tween.stopAllByTarget(this.node);
    }
}
