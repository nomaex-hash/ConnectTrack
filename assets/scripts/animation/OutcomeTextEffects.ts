import { Label, Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import { CurvedLabel } from '../ui/widget/CurvedLabel';

/**
 * Hiệu ứng chữ kết quả (WELL DONE/LOSE/GREAT JOB...) dùng chung giữa ResultPopup và
 * DailyResultPopup — tránh trùng lặp logic khi cả 2 popup đều cần đúng 1 kiểu hiệu ứng:
 * chữ scale to → đập nhỏ hơn gốc → nảy lại kèm mờ→đậm, và ánh sáng phía sau nhún 1 nhịp
 * rồi mờ dần biến mất, hiện trễ hơn chữ.
 */

/**
 * Gán nội dung chữ — ưu tiên CurvedLabel (chữ cong) nếu node có gắn component đó, không
 * thì lùi về cc.Label thường (thẳng). Cùng 1 lời gọi dùng được cho cả 2 kiểu node.
 */
export function setOutcomeText(node: Node | null, text: string): void {
    if (!node) return;

    const curved = node.getComponent(CurvedLabel) ?? node.getComponentInChildren(CurvedLabel);
    if (curved) {
        curved.setText(text);
        return;
    }

    const label = node.getComponent(Label) ?? node.getComponentInChildren(Label);
    if (label) label.string = text;
}

export interface OutcomeTextPopOptions {
    readonly fromScale: number;
    readonly undershootScale: number;
    readonly dropSeconds: number;
    readonly bounceSeconds: number;
}

export function playOutcomeTextPop(node: Node | null, opts: OutcomeTextPopOptions): void {
    if (!node) return;

    const original = new Vec3(node.scale.x, node.scale.y, node.scale.z || 1);
    const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    Tween.stopAllByTarget(node);
    Tween.stopAllByTarget(opacity);

    const fromScale = new Vec3(original.x * opts.fromScale, original.y * opts.fromScale, original.z);
    const undershootScale = new Vec3(
        original.x * opts.undershootScale,
        original.y * opts.undershootScale,
        original.z,
    );

    node.setScale(fromScale);
    opacity.opacity = 0;

    tween(node)
        .to(opts.dropSeconds, { scale: undershootScale }, { easing: 'quadIn' })
        .to(opts.bounceSeconds, { scale: original }, { easing: 'backOut' })
        .start();

    tween(opacity)
        .to(opts.dropSeconds + opts.bounceSeconds, { opacity: 255 })
        .start();
}

export interface OutcomeGlowOptions {
    readonly delaySeconds: number;
    readonly squishScale: number;
    readonly squishSeconds: number;
    readonly holdSeconds: number;
    readonly fadeSeconds: number;
}

/**
 * Ẩn hẳn (opacity 0) cho tới đúng lúc `delaySeconds` trôi qua — KHÔNG hiện sẵn trong lúc
 * chờ — rồi mới bật lên NGAY LÚC bắt đầu nhún (scale 1 → squishScale → 1), đứng yên một
 * chút, sau đó mờ dần biến mất hẳn (tự set node.active = false khi xong).
 */
export function playOutcomeGlow(node: Node | null, opts: OutcomeGlowOptions): void {
    if (!node) return;

    Tween.stopAllByTarget(node);
    const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    Tween.stopAllByTarget(opacity);

    const original = new Vec3(1, 1, 1);
    const squished = new Vec3(opts.squishScale, opts.squishScale, 1);

    node.active = true;
    node.setScale(original);
    opacity.opacity = 0;

    tween(node)
        .delay(opts.delaySeconds)
        .call(() => {
            opacity.opacity = 255;
        })
        .to(opts.squishSeconds, { scale: squished }, { easing: 'quadOut' })
        .to(opts.squishSeconds, { scale: original }, { easing: 'quadOut' })
        .start();

    tween(opacity)
        .delay(opts.delaySeconds + opts.squishSeconds * 2 + opts.holdSeconds)
        .to(opts.fadeSeconds, { opacity: 0 })
        .call(() => {
            if (node.isValid) node.active = false;
        })
        .start();
}

/** Đóng popup giữa chừng nhịp nhún/mờ dần thì gọi hàm này — dừng hẳn, tránh chồng tween lần mở sau. */
export function stopOutcomeGlow(node: Node | null): void {
    if (!node?.isValid) return;
    Tween.stopAllByTarget(node);
    const opacity = node.getComponent(UIOpacity);
    if (opacity) Tween.stopAllByTarget(opacity);
}
