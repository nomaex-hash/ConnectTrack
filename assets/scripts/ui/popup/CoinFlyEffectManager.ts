import { _decorator, Component, Node, Sprite, SpriteFrame, UIOpacity, UITransform, Vec3, tween, Tween } from 'cc';

const { ccclass, property } = _decorator;

const FLY_SECONDS = 0.5;
const ICON_SIZE = 48;

/**
 * Bay 1 icon coin từ điểm mua tới icon coin trên thanh trên cùng — adapt hành vi từ
 * Reference/EfxCoinManager.ts (bản gốc dùng Prefab ParticleSystem qua pool riêng), nhưng
 * Dogdoku chưa có VFX particle nên dùng thẳng 1 Sprite coin.png tween worldPosition — không cần
 * prefab riêng, chỉ cần gán 1 SpriteFrame. Singleton theo đúng convention AudioManager.instance.
 */
@ccclass('CoinFlyEffectManager')
export class CoinFlyEffectManager extends Component {
    private static _instance: CoinFlyEffectManager | null = null;
    static get maybeInstance(): CoinFlyEffectManager | null {
        return this._instance;
    }

    @property(SpriteFrame)
    coinSpriteFrame: SpriteFrame | null = null;

    @property({ type: Node, tooltip: 'Node cha đứng trên cùng (overlay layer) để icon bay không bị Mask/ScrollView khác che cắt.' })
    flyLayer: Node | null = null;

    protected onLoad(): void {
        CoinFlyEffectManager._instance = this;
    }

    protected onDestroy(): void {
        if (CoinFlyEffectManager._instance === this) CoinFlyEffectManager._instance = null;
    }

    playFlyToTarget(fromWorldPos: Vec3, toWorldPos: Vec3): void {
        if (!this.flyLayer || !this.coinSpriteFrame) return;

        const iconNode = new Node('CoinFlyIcon');
        iconNode.layer = this.flyLayer.layer;
        iconNode.setParent(this.flyLayer);
        iconNode.setWorldPosition(fromWorldPos);

        const transform = iconNode.addComponent(UITransform);
        transform.setContentSize(ICON_SIZE, ICON_SIZE);

        const sprite = iconNode.addComponent(Sprite);
        sprite.spriteFrame = this.coinSpriteFrame;

        const opacity = iconNode.addComponent(UIOpacity);
        opacity.opacity = 255;

        Tween.stopAllByTarget(iconNode);
        tween(iconNode)
            .to(FLY_SECONDS, { worldPosition: toWorldPos }, { easing: 'quadIn' })
            .call(() => iconNode.destroy())
            .start();
        tween(opacity).delay(FLY_SECONDS * 0.6).to(FLY_SECONDS * 0.4, { opacity: 0 }).start();
    }
}
