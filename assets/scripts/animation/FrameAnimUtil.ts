import { Animation, AnimationClip, Node } from 'cc';


/** clipName trống thì phát clips[0] (hành vi cũ) — truyền vào để phát ĐÚNG 1 clip cụ thể khi
 * Animation component chứa NHIỀU clip (vd hộp quà Idle/Gift/Open dùng chung 1 component). */
export function playFrameAnimation(node: Node | null, loop = false, clipName?: string): Animation | null {
    if (!node || !node.isValid) return null;

    node.active = true;

    const animation = node.getComponent(Animation);
    const clip = clipName ? animation?.clips.find((c) => c?.name === clipName) ?? null : animation?.clips[0] ?? null;
    if (!animation || !clip) {
        if (animation && clipName) {
            const available = animation.clips.map((c) => c?.name).join(', ');
            console.warn(
                `[FrameAnimUtil] Không tìm thấy clip '${clipName}' trên node '${node.name}' ` +
                    `(tên clip thật trong component: [${available}]) — kiểm tra lại property "Name" ` +
                    `bên trong clip đó (khác với tên file .anim).`,
            );
        }
        return null;
    }

    const state = animation.getState(clip.name);
    if (state) state.wrapMode = loop ? AnimationClip.WrapMode.Loop : AnimationClip.WrapMode.Normal;

    animation.play(clip.name);
    return animation;
}
