import { _decorator, Component, Node, Tween, UIOpacity, Vec3, tween } from 'cc';

const { ccclass, property } = _decorator;


@ccclass('PopupAnimation')
export class PopupAnimation extends Component {
    @property({
        type: Node,
        tooltip: 'Node được phóng/thu — thường là Panel bên trong. Trống thì dùng chính node này.',
    })
    target: Node | null = null;

    @property({ tooltip: 'Thời gian hiện ra (giây).' })
    enterDuration = 0.22;

    @property({ tooltip: 'Thời gian biến mất (giây).' })
    exitDuration = 0.14;

    @property({ range: [0.1, 1, 0.01], slide: true, tooltip: 'Scale lúc BẮT ĐẦU hiện ra.' })
    enterFromScale = 0.7;

    @property({ range: [0.1, 1, 0.01], slide: true, tooltip: 'Scale lúc KẾT THÚC biến mất.' })
    exitToScale = 0.75;

    private opacity: UIOpacity | null = null;

    playEnter(): void {
        const node = this.resolveTarget();
        if (!node) return;

        Tween.stopAllByTarget(node);
        node.setScale(this.enterFromScale, this.enterFromScale, 1);
        tween(node)
            .to(this.enterDuration, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();

        const opacity = this.resolveOpacity(node);
        if (!opacity) return;

        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;
        tween(opacity).to(this.enterDuration, { opacity: 255 }).start();
    }

    playExit(onDone: () => void): void {
        const node = this.resolveTarget();
        if (!node) {
            onDone();
            return;
        }

        const opacity = this.resolveOpacity(node);

        Tween.stopAllByTarget(node);
        tween(node)
            .to(
                this.exitDuration,
                { scale: new Vec3(this.exitToScale, this.exitToScale, 1) },
                { easing: 'quadIn' },
            )
            .call(() => {
                this.resetInstantly(node, opacity); 
                onDone();
            })
            .start();

        if (!opacity) return;
        Tween.stopAllByTarget(opacity);
        tween(opacity).to(this.exitDuration, { opacity: 0 }).start();
    }


    stopAndReset(): void {
        const node = this.resolveTarget();
        if (!node) return;
        this.resetInstantly(node, this.resolveOpacity(node));
    }

    onDestroy(): void {
        if (this.opacity?.isValid) Tween.stopAllByTarget(this.opacity);
    }

    private resetInstantly(node: Node, opacity: UIOpacity | null): void {
        Tween.stopAllByTarget(node);
        node.setScale(1, 1, 1);

        if (!opacity) return;
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 255;
    }

    private resolveTarget(): Node | null {
        const node = this.target ?? this.node;
        return node && node.isValid ? node : null;
    }

    private resolveOpacity(node: Node): UIOpacity | null {
        if (!this.opacity || !this.opacity.isValid) {
            this.opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        }
        return this.opacity;
    }
}
