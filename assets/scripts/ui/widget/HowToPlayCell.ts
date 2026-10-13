import { _decorator, Component, Sprite, SpriteFrame, Tween, UIOpacity, UITransform, tween } from 'cc';

const { ccclass, property } = _decorator;

const BLINK_HALF_SECONDS = 0.4;
const BLINK_MIN_OPACITY = 70;


@ccclass('HowToPlayCell')
export class HowToPlayCell extends Component {
    @property({ type: Sprite, tooltip: 'Sprite icon trong ô (chó hoặc dấu X).' })
    icon: Sprite | null = null;

    private iconOpacity: UIOpacity | null = null;


    setIcon(frame: SpriteFrame | null, sizeRatio = 0.96): void {
        this.setBlink(false);

        const node = this.icon?.node;
        if (!this.icon || !node) return;

        if (frame) {
            this.icon.sizeMode = Sprite.SizeMode.CUSTOM;
            this.icon.spriteFrame = frame;
            const cellTransform = this.getComponent(UITransform);
            const iconTransform = node.getComponent(UITransform);
            const { width, height } = frame.rect;
            if (cellTransform && iconTransform && width > 0 && height > 0) {
                const scale = Math.min(cellTransform.width, cellTransform.height) * sizeRatio / Math.max(width, height);
                iconTransform.setContentSize(width * scale, height * scale);
            }
            node.active = true;
        } else {
            node.active = false;
        }
    }

    setBlink(on: boolean): void {
        const opacity = this.resolveOpacity();
        if (!opacity) return;

        Tween.stopAllByTarget(opacity);
        opacity.opacity = 255;
        if (!on) return;

        tween(opacity)
            .repeatForever(
                tween<UIOpacity>()
                    .to(BLINK_HALF_SECONDS, { opacity: BLINK_MIN_OPACITY })
                    .to(BLINK_HALF_SECONDS, { opacity: 255 }),
            )
            .start();
    }

    onDestroy(): void {
      
        if (this.iconOpacity?.isValid) Tween.stopAllByTarget(this.iconOpacity);
    }

    private resolveOpacity(): UIOpacity | null {
        const node = this.icon?.node;
        if (!node || !node.isValid) return null;

        if (!this.iconOpacity || !this.iconOpacity.isValid) {
            this.iconOpacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        }
        return this.iconOpacity;
    }
}
