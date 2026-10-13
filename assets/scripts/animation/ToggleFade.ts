import { Node, Tween, UIOpacity, Vec3, tween } from 'cc';

const SHOW_SECONDS = 0.15;
const HIDE_SECONDS = 0.12;


export function setActiveAnimated(node: Node | null, active: boolean): void {
    if (!node) return;
    if (node.active === active) return;

    Tween.stopAllByTarget(node);
    const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    Tween.stopAllByTarget(opacity);

    if (active) {
        node.active = true;
        node.setScale(0.4, 0.4, 1);
        opacity.opacity = 0;

        tween(node).to(SHOW_SECONDS, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        tween(opacity).to(SHOW_SECONDS, { opacity: 255 }).start();
        return;
    }

    tween(node).to(HIDE_SECONDS, { scale: new Vec3(0.4, 0.4, 1) }, { easing: 'quadIn' }).start();
    tween(opacity)
        .to(HIDE_SECONDS, { opacity: 0 })
        .call(() => {
            node.active = false;
            node.setScale(1, 1, 1);
            opacity.opacity = 255;
        })
        .start();
}
