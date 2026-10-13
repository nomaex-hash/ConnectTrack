import { _decorator, sp, Tween, Vec3, tween } from 'cc';
import { APPEAR_DURATION } from './CellView';
import { DogView } from './DogView';

const { ccclass, property } = _decorator;


const ANIM_APPEAR = 'Appear';
const ANIM_IDLE = 'idle';
const ANIM_CELEBRATE = 'idle1';
const ANIM_CRY = 'cry';
const ANIM_FRUSTRATED = 'frustrated';

const TRACK = 0;


@ccclass('DogSpineView')
export class DogSpineView extends DogView {
    @property({ type: sp.Skeleton, tooltip: 'sp.Skeleton gắn skeleton data head_dog' })
    skeleton: sp.Skeleton = null!;

    @property({
        tooltip:
            'Cạnh LỚN HƠN của phần nhìn thấy (đầu chó: 221.89 × 225.35) → lấy 225.35 để ' +
            'đầu chó lọt ô vuông ở cả hai chiều.',
    })
    designSize = 225.35;

    @property({ tooltip: 'Tâm X của phần nhìn thấy so với gốc root.' })
    centerOffsetX = 8.29;

    @property({ tooltip: 'Tâm Y — đầu chó nằm phía trên root.' })
    centerOffsetY = 110.66;

    private readonly tempScale = new Vec3();
    private readonly tempPos = new Vec3();

    onLoad(): void {
        if (!this.skeleton) {
            throw new Error('[DogSpineView] DogSpine.prefab chưa gán ô "skeleton".');
        }

        this.skeleton.premultipliedAlpha = false;
    }


    place(localPos: Readonly<Vec3>, size: number): void {
        const scale = this.designSize > 0 ? size / this.designSize : 1;

        this.tempPos.set(
            localPos.x - this.centerOffsetX * scale,
            localPos.y - this.centerOffsetY * scale,
            localPos.z,
        );
        this.node.setPosition(this.tempPos);

        this.tempScale.set(scale, scale, 1);
        this.node.setScale(this.tempScale);
    }

    /** Không có particle/ring riêng cần dọn — chỉ cần trả animation về idle cho sạch. */
    reset(): void {
        this.skeleton.setAnimation(TRACK, ANIM_IDLE, true);
    }

    playAppear(onSettled?: () => void): void {
        this.skeleton.setAnimation(TRACK, ANIM_APPEAR, false);
        this.skeleton.addAnimation(TRACK, ANIM_IDLE, true);

        if (!onSettled) return;
        // Complete listener bắn cho MỌI animation (kể cả idle lặp) — chỉ cần lần ĐẦU
        // (Appear phát xong) nên gỡ ngay sau khi gọi, không thì onSettled bắn lặp lại.
        this.skeleton.setCompleteListener(() => {
            this.skeleton.setCompleteListener(null);
            onSettled();
        });
    }

    /**
     * Ô đã có chó SẴN (vào màn / resume) — KHÔNG chạy animation Appear, hiện thẳng Idle,
     * nhưng vẫn scale từ 0 lên như CHÍNH Ô của nó (CellView.playAppear — cùng
     * APPEAR_DURATION, cùng easing backOut) để đồng bộ cảm giác "bàn cờ hiện lên".
     */
    playRevealAppear(): void {
        this.playIdle();

        const target = new Vec3(this.tempScale.x, this.tempScale.y, 1);
        Tween.stopAllByTarget(this.node);
        this.node.setScale(0, 0, 1);
        tween(this.node).to(APPEAR_DURATION, { scale: target }, { easing: 'backOut' }).start();
    }

    playIdle(): void {
        this.skeleton.setAnimation(TRACK, ANIM_IDLE, true);
    }

    playFrustrated(): void {
        this.skeleton.setAnimation(TRACK, ANIM_FRUSTRATED, false);
        this.skeleton.addAnimation(TRACK, ANIM_IDLE, true);
    }

    playCry(): void {
        this.skeleton.setAnimation(TRACK, ANIM_CRY, true);
    }

    playCelebrate(): void {
        this.skeleton.setAnimation(TRACK, ANIM_CELEBRATE, true);
    }
}
