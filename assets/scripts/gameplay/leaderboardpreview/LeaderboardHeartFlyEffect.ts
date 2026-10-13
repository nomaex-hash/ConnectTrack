import { _decorator, Component, Node, NodePool, Prefab, Sprite, SpriteFrame, UIOpacity, UITransform, Vec3, instantiate, tween, Tween } from 'cc';
import { ItemCoinLabel } from '../../common/ItemCoinLabel';
const { ccclass, property } = _decorator;

const ICON_SIZE = 56;
const POP_IN_SECONDS = 0.2;
const FADE_IN_SECONDS = 0.2;
const PLUS_LABEL_LIFETIME_SECONDS = 1.2;

/**
 * Hiệu ứng icon bay trong LeaderboardPreview — mỗi icon hiện ra TẠI ĐÚNG điểm xuất phát (scale
 * 0→iconScale, opacity 0→255, không còn lệch ngẫu nhiên/bung ra quanh điểm xuất phát như trước —
 * xác nhận từ user: bỏ hẳn pha "bung ra", chỉ còn hiện ra rồi bay thẳng vào đích), chờ 1 nhịp
 * (holdSeconds) rồi bay THẲNG vào đích, kèm nhãn "+N" tại điểm xuất phát. Tách riêng khỏi
 * CoinPoolManager vì component đó gắn chặt với ví vàng (COIN_UPDATE cộng vàng thật khi coin tới
 * đích) — ở đây chỉ báo qua callback để UI tự tăng số điểm hiển thị, KHÔNG đụng dữ liệu gì.
 */
@ccclass('LeaderboardHeartFlyEffect')
export class LeaderboardHeartFlyEffect extends Component {
    @property({
        type: SpriteFrame,
        tooltip:
            'Sprite icon bay vào ô điểm — ConnectTracks (xác nhận từ user): đổi sang sprite ĐƯỜNG ' +
            'RAY (không còn trái tim) vì điểm xếp hạng giờ tính theo số ô ray của màn, không phải ' +
            'số tim còn lại. Tên property/class vẫn giữ "heart" (đổi sẽ động chạm nhiều nơi không ' +
            'cần thiết) — chỉ cần gán ĐÚNG ảnh ray ở đây, không ảnh hưởng gì tới logic.',
    })
    heartSpriteFrame: SpriteFrame | null = null;

    @property({
        type: Node,
        tooltip: 'Node cha các icon bay — đặt NGOÀI ScrollView/Mask (vd con trực tiếp của popup, nằm trên ScrollView) để icon không bị cắt.',
    })
    flyLayer: Node | null = null;

    @property({
        type: Prefab,
        tooltip: 'Tuỳ chọn: prefab nhãn "+N" (dùng lại ItemCoinLabelEfx.prefab của hiệu ứng vàng). Trống thì không hiện nhãn.',
    })
    plusLabelPrefab: Prefab | null = null;

    @property({
        tooltip:
            'Scale icon bay (ConnectTracks: icon đường ray) khi đã "bung ra" hết cỡ — áp dụng cho ' +
            'ĐÍCH của tween bung ra (node bắt đầu từ scale 0, phóng to tới đúng giá trị này), không ' +
            'phải scale tĩnh lúc tạo node. 1 = giữ nguyên kích thước gốc ICON_SIZE (56px).',
    })
    iconScale = 1;

    @property({ tooltip: 'Khoảng cách thời gian giữa 2 icon liên tiếp (giây).' })
    staggerSeconds = 0.12;

    @property({ tooltip: 'Đứng yên tại điểm xuất phát (sau khi hiện ra) trước khi bay thẳng vào đích (giây).' })
    holdSeconds = 0.3;

    @property({ tooltip: 'Thời gian bay từ chỗ bung tới đích (giây).' })
    flySeconds = 0.5;

    private readonly pool = new NodePool();

    protected onDestroy(): void {
        this.pool.clear();
    }

    /**
     * @param count số icon tim bay (mỗi icon tới đích gọi onArrive(index) 1 lần).
     * @param plusValue số hiện ở nhãn "+N" (nếu có plusLabelPrefab).
     * @param onDone gọi 1 lần sau khi icon CUỐI CÙNG tới đích; gọi ngay nếu không thể chạy hiệu ứng.
     */
    play(
        fromWorldPos: Vec3,
        toWorldPos: Vec3,
        count: number,
        plusValue: number,
        onArrive: (index: number) => void,
        onDone: () => void,
    ): void {
        if (!this.flyLayer || !this.heartSpriteFrame || count <= 0) {
            onDone();
            return;
        }

        const labelNode = this.showPlusLabel(fromWorldPos, plusValue);

        let arrived = 0;
        for (let i = 0; i < count; i++) {
            const node = this.acquireIcon();
            const opacity = node.getComponent(UIOpacity)!;
            node.setParent(this.flyLayer);
            // Icon tim mới thêm luôn vẽ ĐÈ LÊN nhãn "+N" (sibling sau cùng vẽ trên cùng) — đẩy
            // nhãn lên trên cùng lại mỗi lần thêm 1 icon để nhãn luôn hiện rõ trong lúc các icon lần lượt hiện ra.
            if (labelNode?.isValid) labelNode.setSiblingIndex(-1);
            node.setWorldPosition(fromWorldPos);
            node.setScale(0, 0, 1);
            opacity.opacity = 0;

            const appearDelay = i * this.staggerSeconds;

            tween(opacity).delay(appearDelay).to(FADE_IN_SECONDS, { opacity: 255 }).start();
            tween(node)
                .delay(appearDelay)
                .to(POP_IN_SECONDS, { scale: new Vec3(this.iconScale, this.iconScale, 1) }, { easing: 'backOut' })
                .delay(this.holdSeconds)
                .to(this.flySeconds, { worldPosition: toWorldPos }, { easing: 'quadIn' })
                .call(() => {
                    this.recycleIcon(node);
                    onArrive(i);
                    arrived++;
                    if (arrived === count) onDone();
                })
                .start();
        }
    }

    private showPlusLabel(fromWorldPos: Vec3, value: number): Node | null {
        if (!this.plusLabelPrefab || !this.flyLayer) return null;

        const labelNode = instantiate(this.plusLabelPrefab);
        labelNode.setParent(this.flyLayer);
        labelNode.setWorldPosition(fromWorldPos);
        labelNode.getComponent(ItemCoinLabel)?.initItemCoinLabel(value);
        this.scheduleOnce(() => {
            if (labelNode.isValid) labelNode.destroy();
        }, PLUS_LABEL_LIFETIME_SECONDS);
        return labelNode;
    }

    private acquireIcon(): Node {
        const pooled = this.pool.get();
        const node = pooled ?? this.createIcon();
        node.getComponent(Sprite)!.spriteFrame = this.heartSpriteFrame;
        return node;
    }

    private createIcon(): Node {
        const node = new Node('HeartFlyIcon');
        node.layer = this.flyLayer!.layer;
        node.addComponent(UITransform).setContentSize(ICON_SIZE, ICON_SIZE);
        node.addComponent(Sprite);
        node.addComponent(UIOpacity);
        return node;
    }

    private recycleIcon(node: Node): void {
        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) Tween.stopAllByTarget(opacity);
        this.pool.put(node);
    }
}
