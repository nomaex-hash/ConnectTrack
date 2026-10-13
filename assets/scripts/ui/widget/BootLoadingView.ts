import { _decorator, Animation, Component, ParticleSystem, Sprite, Tween, UIOpacity, tween, isValid } from 'cc';

const { ccclass } = _decorator;

/** Presentation only: the boot controller supplies actual loading progress. */
@ccclass('BootLoadingView')
export class BootLoadingView extends Component {
    private fill: Sprite | null = null;
    private opacity: UIOpacity | null = null;
    private finishReveal: ((ready: boolean) => void) | null = null;
    private targetProgress = 0;
    private displayedProgress = 0;
    private finishProgress: ((ready: boolean) => void) | null = null;

    prepare(): void {
        this.fill = this.node.getChildByPath('Loadingbar/load')?.getComponent(Sprite) ?? null;
        if (!this.fill) throw new Error('Boot prefab thiếu Sprite Loadingbar/load.');
        this.fill.type = Sprite.Type.FILLED;
        this.fill.fillType = Sprite.FillType.HORIZONTAL;
        this.fill.fillStart = 0;
        this.fill.fillRange = 0;
        this.opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        this.opacity.opacity = 0;

        // Preserve the authored chimney offset, then let the emitter follow the locomotive.
        const smoke = this.node.getChildByName('Particle');
        const locomotive = this.node.getChildByPath('Train/Train1');
        if (smoke && locomotive) smoke.setParent(locomotive, true);
    }

    reveal(seconds: number): Promise<boolean> {
        for (const name of ['Group', 'Train']) {
            const group = this.node.getChildByName(name);
            for (const animation of group?.getComponentsInChildren(Animation) ?? []) {
                if (animation.defaultClip) animation.play();
            }
        }
        for (const particle of this.node.getComponentsInChildren(ParticleSystem)) particle.play();
        return new Promise(resolve => {
            this.finishReveal = resolve;
            tween(this.opacity!).to(Math.max(0, seconds), { opacity: 255 }).call(() => {
                this.finishReveal = null;
                resolve(true);
            }).start();
        });
    }

    setProgress(progress: number): void {
        if (!Number.isFinite(progress)) return;
        this.targetProgress = Math.max(this.targetProgress, Math.min(1, Math.max(0, progress)));
    }

    update(dt: number): void {
        if (!isValid(this.fill, true)) return;
        // Approach actual progress smoothly; never invent progress beyond the completed work.
        this.displayedProgress = Math.min(this.targetProgress, this.displayedProgress + Math.max(0, dt) * 1.5);
        this.fill!.fillRange = this.displayedProgress;
        if (this.displayedProgress >= 1 && this.finishProgress) {
            // Bootloader waits for AFTER_DRAW before switching scenes.
            const finish = this.finishProgress;
            this.finishProgress = null;
            finish(true);
        }
    }

    complete(): Promise<boolean> {
        this.setProgress(1);
        return new Promise(resolve => { this.finishProgress = resolve; });
    }

    onDestroy(): void {
        if (this.opacity) Tween.stopAllByTarget(this.opacity);
        this.finishReveal?.(false);
        this.finishReveal = null;
        this.finishProgress?.(false);
        this.finishProgress = null;
    }
}
