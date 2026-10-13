import { _decorator, Animation, Node, ParticleSystem, Tween, UIOpacity, Vec3, tween } from 'cc';
import { playFrameAnimation } from '../../animation/FrameAnimUtil';
import { APPEAR_DURATION } from './CellView';
import { DogView } from './DogView';

const { ccclass, property } = _decorator;

/**
 * Nhân vật trong ô dùng ANIMATION KHUNG HÌNH (bộ chim cánh cụt trong `assets/animations`).
 *
 * Cách prefab được dựng: MỖI TRẠNG THÁI là một NODE CON riêng, mỗi node mang một
 * cc.Animation chứa đúng một clip. Vì vậy "đổi trạng thái" = bật node của trạng thái
 * đó, tắt các node còn lại, rồi chạy animation của nó (luôn Normal, không lặp).
 *
 * Cùng hợp đồng DogView với DogSpineView nên thay qua lại chỉ bằng đổi prefab gán
 * vào BoardView.dogSpinePrefab.
 */
@ccclass('PenguinAnimView')
export class PenguinAnimView extends DogView {
    @property({ type: Node, tooltip: 'Node trạng thái "vừa xuất hiện" (Appear).' })
    appearNode: Node | null = null;

    @property({ type: Node, tooltip: 'Node trạng thái đứng yên (Idle).' })
    idleNode: Node | null = null;

    @property({ type: Node, tooltip: 'Node trạng thái buồn khi người chơi đặt sai (Sad).' })
    sadNode: Node | null = null;

    @property({ type: Node, tooltip: 'Node bắt đầu khóc khi thua (Crystart).' })
    cryStartNode: Node | null = null;

    @property({ type: Node, tooltip: 'Node khóc tiếp sau Crystart (Cryloop).' })
    cryLoopNode: Node | null = null;

    @property({
        type: Node,
        tooltip: 'Node ăn mừng khi thắng. Bỏ trống thì dùng lại Idle.',
    })
    celebrateNode: Node | null = null;

    @property({
        tooltip:
            'Cạnh khung hình gốc (px) — dùng để co nhân vật cho vừa cạnh ô. ' +
            'Đặt đúng kích thước ảnh trong animation.',
    })
    designSize = 225;

    @property({ tooltip: 'Lệch tâm X của phần nhìn thấy so với gốc node.' })
    centerOffsetX = 0;

    @property({ tooltip: 'Lệch tâm Y của phần nhìn thấy so với gốc node.' })
    centerOffsetY = 0;

    @property({
        type: ParticleSystem,
        tooltip:
            'Particle bắn ra khi đặt ĐÚNG (playAppear). Nên đặt sẵn làm con của node này, ' +
            'giữa ô. Có thể để trống.',
    })
    correctBurstParticle: ParticleSystem | null = null;

    @property({ tooltip: 'Đặt đúng: nhân vật phồng to hơn scale chuẩn bao nhiêu lần trước khi đập về scale chuẩn.' })
    correctBounceScale = 1.2;

    @property({ tooltip: 'Đặt đúng: thời gian phồng to (giây), thời gian đập về scale chuẩn dài gấp đôi mốc này.' })
    correctBounceSeconds = 0.12;

    @property({
        tooltip:
            'Chuyển từ node Appear sang Idle: thời gian hoà mờ (giây) — node Idle rõ dần lên ' +
            'trong khi Appear mờ dần đi, thay vì tắt/bật tức thì (đỡ bị giật nếu 2 node không ' +
            'khớp hệt tư thế lúc chuyển). Để 0 nếu muốn đổi tức thì như cũ.',
    })
    appearToIdleFadeSeconds = 0.08;

    @property({
        tooltip:
            'Particle đặt đúng: tự ẨN node particle sau bao lâu (giây) kể từ lúc bắn, ' +
            'PHÒNG KHI asset particle bị lặp/duration dài khiến nó không tự biến mất. ' +
            'Nên đặt bằng hoặc hơi dài hơn Duration thật của particle.',
    })
    correctBurstHideSeconds = 0.6;

    @property({
        type: Node,
        tooltip:
            'Sprite vòng tròn bắn ra khi đặt ĐÚNG: phóng to dần + mờ dần. Nên đặt sẵn làm ' +
            'con của node này, giữa ô, có UIOpacity. Có thể để trống.',
    })
    correctRingNode: Node | null = null;

    @property({ tooltip: 'Vòng tròn: scale bắt đầu (nhỏ).' })
    correctRingFromScale = 0.3;

    @property({ tooltip: 'Vòng tròn: scale kết thúc (lớn) trước khi ẩn.' })
    correctRingToScale = 1.5;

    @property({ tooltip: 'Vòng tròn: thời gian phóng to + mờ dần (giây).' })
    correctRingSeconds = 0.35;

    private readonly tempScale = new Vec3();
    private readonly tempPos = new Vec3();
    private standardScale = 1;
    private bounceTween: Tween<Node> | null = null;
    private ringTween: Tween<Node> | null = null;
    private ringOpacity: UIOpacity | null = null;
    private readonly stateOpacities = new Map<Node, UIOpacity>();

    /** Animation đang chờ sự kiện FINISHED — giữ để huỷ khi đổi trạng thái. */
    private pendingChain: Animation | null = null;

    /**
     * TRUE trong khoảng đang chờ animation Appear phát xong để đập xuống (playAppearBounce
     * → playBounceDown). Nếu có gì đó huỷ ngang animation đang chờ (ví dụ playFrustrated()
     * do đặt sai Ở Ô KHÁC — BoardView.playDogEmotion gọi cho MỌI chó trên bàn) TRONG lúc
     * cờ này còn true, clearPendingChain() sẽ tự kích hoạt đập xuống (có tween, không kẹt
     * scale to) CHẠY SONG SONG với animation trạng thái mới (buồn/khóc/...), thay vì ép
     * scale về ngay lập tức — 2 animation không đụng nhau vì scale nằm trên node gốc,
     * animation trạng thái nằm trên node con.
     */
    private awaitingBounceDown = false;
    private pendingOnSettled: (() => void) | null = null;

    onLoad(): void {
        this.hideAllStates();

        if (this.correctRingNode) {
            this.ringOpacity =
                this.correctRingNode.getComponent(UIOpacity) ?? this.correctRingNode.addComponent(UIOpacity);
            this.correctRingNode.active = false;
        }
    }

    onDestroy(): void {
        this.clearPendingChain();
        this.bounceTween?.stop();
        this.ringTween?.stop();
    }

    place(localPos: Readonly<Vec3>, size: number): void {
        const scale = this.designSize > 0 ? size / this.designSize : 1;
        this.standardScale = scale;

        this.tempPos.set(
            localPos.x - this.centerOffsetX * scale,
            localPos.y - this.centerOffsetY * scale,
            localPos.z,
        );
        this.node.setPosition(this.tempPos);

        this.tempScale.set(scale, scale, 1);
        this.node.setScale(this.tempScale);
    }

    /** Dọn sạch trạng thái còn sót từ lần dùng TRƯỚC (node bị pool tái sử dụng). */
    reset(): void {
        this.clearPendingChain();

        this.bounceTween?.stop();
        this.bounceTween = null;

        this.unschedule(this.hideCorrectBurst);
        this.hideCorrectBurst();

        this.ringTween?.stop();
        this.ringTween = null;
        if (this.correctRingNode) this.correctRingNode.active = false;
        if (this.ringOpacity) this.ringOpacity.opacity = 255;

        this.hideAllStates();
    }

    /** Đặt ĐÚNG do người chơi thao tác — đầy đủ particle + ring. */
    playAppear(onSettled?: () => void): void {
        this.playAppearBounce(true, onSettled);
    }

    /**
     * Ô đã có chó SẴN lúc bàn cờ vừa dựng (mới vào màn / resume ván đang chơi dở) — KHÔNG
     * phải người chơi vừa đặt, nên KHÔNG chạy animation Appear, KHÔNG phồng to/đập xuống,
     * KHÔNG particle/ring gì cả — chỉ hiện thẳng ở trạng thái Idle, nhưng vẫn scale từ 0
     * lên như CHÍNH Ô của nó (CellView.playAppear — cùng APPEAR_DURATION, cùng easing
     * backOut) để đồng bộ cảm giác "bàn cờ hiện lên" thay vì bật ra khô khan.
     */
    playRevealAppear(): void {
        this.playIdle();

        const s = this.standardScale;
        Tween.stopAllByTarget(this.node);
        this.node.setScale(0, 0, 1);
        tween(this.node).to(APPEAR_DURATION, { scale: new Vec3(s, s, 1) }, { easing: 'backOut' }).start();
    }

    /**
     * Phồng to hơn scale chuẩn NGAY, GIỮ NGUYÊN trong suốt lúc animation Appear đang phát
     * — chỉ đập xuống lại scale chuẩn SAU KHI animation Appear phát xong hẳn (không chạy
     * song song / không cắt ngang giữa chừng). `onSettled` gọi khi đập xuống xong hẳn.
     */
    private playAppearBounce(withEffects: boolean, onSettled?: () => void): void {
        // Dọn sạch chu trình phồng-đập TREO từ lần trước (nếu bị ngắt ngang chưa kịp đập
        // xuống) TRƯỚC khi bắt đầu chu trình mới — activate() bên dưới cũng gọi lại
        // clearPendingChain() nhưng lúc đó cờ đã sạch nên không đụng gì tới lần này.
        this.clearPendingChain();

        const s = this.standardScale;
        const big = new Vec3(s * this.correctBounceScale, s * this.correctBounceScale, 1);
        this.node.setScale(s * 0.4, s * 0.4, 1);
        this.bounceTween = tween(this.node)
            .to(this.correctBounceSeconds, { scale: big }, { easing: 'quadOut' })
            .call(() => { this.bounceTween = null; })
            .start();

        if (withEffects) {
            this.playCorrectBurst();
            this.playCorrectRing();
        }

        const animation = this.activate(this.appearNode);
        if (!animation) {
            this.crossfadeState(null, this.idleNode);
            this.playBounceDown(onSettled);
            return;
        }

        this.pendingChain = animation;
        this.awaitingBounceDown = true;
        this.pendingOnSettled = onSettled ?? null;
        animation.once(Animation.EventType.FINISHED, () => {
            this.pendingChain = null;
            this.awaitingBounceDown = false;
            this.pendingOnSettled = null;
            this.crossfadeState(this.appearNode, this.idleNode);
            this.playBounceDown(onSettled);
        });
    }

    private opacityFor(node: Node): UIOpacity {
        let opacity = this.stateOpacities.get(node);
        if (!opacity || !opacity.isValid) {
            opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
            this.stateOpacities.set(node, opacity);
        }
        return opacity;
    }

    /**
     * Chuyển từ `from` sang `to` bằng cách hoà mờ (bật `to` đè lên, mờ dần `from`, rõ dần
     * `to`) thay vì tắt/bật tức thì — đỡ giật khi 2 node trạng thái không khớp hệt tư thế.
     * `appearToIdleFadeSeconds` = 0 thì lùi về cách cũ (đổi tức thì).
     */
    private crossfadeState(from: Node | null, to: Node | null): void {
        if (this.appearToIdleFadeSeconds <= 0 || !from?.isValid || !to) {
            this.hideAllStates();
            playFrameAnimation(to);
            return;
        }

        for (const node of this.stateNodes()) {
            if (node && node !== from && node !== to) node.active = false;
        }

        to.active = true;
        const toOpacity = this.opacityFor(to);
        Tween.stopAllByTarget(toOpacity);
        toOpacity.opacity = 0;
        playFrameAnimation(to);
        tween(toOpacity).to(this.appearToIdleFadeSeconds, { opacity: 255 }).start();

        const fromOpacity = this.opacityFor(from);
        Tween.stopAllByTarget(fromOpacity);
        tween(fromOpacity)
            .to(this.appearToIdleFadeSeconds, { opacity: 0 })
            .call(() => {
                from.active = false;
                fromOpacity.opacity = 255;
            })
            .start();
    }

    /** Đập xuống lại scale chuẩn — gọi SAU KHI animation Appear đã phát xong hẳn. */
    private playBounceDown(onSettled?: () => void): void {
        this.bounceTween?.stop();

        const s = this.standardScale;
        this.bounceTween = tween(this.node)
            .to(this.correctBounceSeconds * 2, { scale: new Vec3(s, s, 1) }, { easing: 'bounceOut' })
            .call(() => {
                this.bounceTween = null;
                onSettled?.();
            })
            .start();
    }

    private playCorrectBurst(): void {
        const particle = this.correctBurstParticle;
        if (!particle) return;

        this.unschedule(this.hideCorrectBurst);
        particle.node.active = true;
        particle.stop();
        particle.clear();
        particle.play();

        // Ép tự ẩn sau correctBurstHideSeconds — phòng khi asset particle lặp/duration dài
        // khiến nó không tự dừng, nhất là khi node bị pool tái sử dụng cho ô khác sau đó.
        this.scheduleOnce(this.hideCorrectBurst, this.correctBurstHideSeconds);
    }

    private hideCorrectBurst = (): void => {
        const particle = this.correctBurstParticle;
        if (!particle?.node.isValid) return;

        particle.stop();
        particle.clear();
        particle.node.active = false;
    };

    /** Đặt đúng: vòng tròn phóng to dần từ nhỏ tới lớn, đồng thời mờ dần rồi tự ẩn. */
    private playCorrectRing(): void {
        const node = this.correctRingNode;
        const opacity = this.ringOpacity;
        if (!node || !opacity) return;

        this.ringTween?.stop();

        node.active = true;
        node.setScale(this.correctRingFromScale, this.correctRingFromScale, 1);
        opacity.opacity = 255;

        this.ringTween = tween(node)
            .to(this.correctRingSeconds, { scale: new Vec3(this.correctRingToScale, this.correctRingToScale, 1) }, { easing: 'quadOut' })
            .call(() => { node.active = false; })
            .start();

        tween(opacity).to(this.correctRingSeconds, { opacity: 0 }, { easing: 'quadIn' }).start();
    }

    playIdle(): void {
        this.playState(this.idleNode);
    }

    playFrustrated(): void {
        this.playOnceThen(this.sadNode, this.idleNode);
    }

    playCry(): void {
        this.playOnceThen(this.cryStartNode, this.cryLoopNode);
    }

    playCelebrate(): void {
        this.playState(this.celebrateNode ?? this.idleNode);
    }


    /** Chạy trạng thái `node`, xong thì chuyển sang `next`. */
    private playOnceThen(node: Node | null, next: Node | null): void {
        const animation = this.activate(node);
        if (!animation) {
            this.playState(next); // thiếu node trạng thái → nhảy thẳng sang bước sau
            return;
        }

        this.pendingChain = animation;
        animation.once(Animation.EventType.FINISHED, () => {
            this.pendingChain = null;
            this.playState(next);
        });
    }

    private playState(node: Node | null): void {
        this.activate(node);
    }

    /**
     * Bật node trạng thái (tắt các node khác) và chạy animation của nó.
     * Trả về cc.Animation vừa chạy, hoặc null nếu node/animation không hợp lệ.
     */
    private activate(node: Node | null): Animation | null {
        this.clearPendingChain();
        this.hideAllStates();

        return playFrameAnimation(node);
    }

    private hideAllStates(): void {
        for (const node of this.stateNodes()) {
            if (!node?.isValid) continue;
            node.active = false;

            const opacity = this.stateOpacities.get(node);
            if (opacity?.isValid) {
                Tween.stopAllByTarget(opacity);
                opacity.opacity = 255;
            }
        }
    }

    private stateNodes(): ReadonlyArray<Node | null> {
        return [
            this.appearNode,
            this.idleNode,
            this.sadNode,
            this.cryStartNode,
            this.cryLoopNode,
            this.celebrateNode,
        ];
    }

    private clearPendingChain(): void {
        if (this.pendingChain?.isValid) {
            this.pendingChain.off(Animation.EventType.FINISHED);
        }
        this.pendingChain = null;

        // Đang treo chờ đập xuống mà bị huỷ ngang (đổi trạng thái khác giữa chừng) — TỰ
        // kích hoạt đập xuống luôn (có tween mượt, không kẹt mãi ở scale to như bug cũ),
        // CHẠY SONG SONG với animation trạng thái mới (buồn/khóc/...) chuẩn bị chạy ngay
        // sau đây — scale (node gốc) và animation trạng thái (node con) không đụng nhau.
        if (this.awaitingBounceDown) {
            this.awaitingBounceDown = false;
            const onSettled = this.pendingOnSettled;
            this.pendingOnSettled = null;
            this.playBounceDown(onSettled ?? undefined);
        }
    }
}
