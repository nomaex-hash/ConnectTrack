// @ts-nocheck
import { _decorator, Component, Node, Prefab, Vec3, instantiate, ParticleSystem } from 'cc';
import { clientEvent } from '../framework/clientEvent';
import { Constants } from '../framework/constants';
const { ccclass, property } = _decorator;

@ccclass('EfxCoinManager')
export class EfxCoinManager extends Component {

    @property(Prefab)
    coinEfx: Prefab = null;

    @property(Node)
    poolParentNode: Node = null;

    private arrPools: Node[] = [];

    static instance: EfxCoinManager = null;

    onLoad() {
        EfxCoinManager.instance = this;
    }

    protected onEnable(): void {
        clientEvent.on(Constants.EFX_COIN_SHOW, this.showEfxCoin, this);
    }

    protected onDisable(): void {
        clientEvent.off(Constants.EFX_COIN_SHOW, this.showEfxCoin, this);
    }

    protected onDestroy(): void {
        clientEvent.off(Constants.EFX_COIN_SHOW, this.showEfxCoin, this);
    }

    // ─── Pool ─────────────────────────────────────────────────
    private getItem(): Node {
        // Tìm node đang inactive trong pool
        for (let i = 0; i < this.arrPools.length; i++) {
            if (!this.arrPools[i].active) {
                return this.arrPools[i];
            }
        }

        // Không có → tạo mới
        const obj = instantiate(this.coinEfx);
        obj.parent = this.poolParentNode ?? this.node;
        this.arrPools.push(obj);
        return obj;
    }

    private returnItem(node: Node) {
        node.active = false;
    }

    // ─── Show ─────────────────────────────────────────────────
    showEfxCoin(targetWorldPos: Vec3) {
        const efxNode = this.getItem();
        efxNode.setWorldPosition(targetWorldPos);
        efxNode.active = true;

        const ps = efxNode.getComponent(ParticleSystem);
        if (ps) {
            ps.stop();
            ps.play();
            const duration = (ps.duration + ps.startLifetime.constant) * 1000;
            setTimeout(() => {
                if (efxNode?.isValid) this.returnItem(efxNode);
            }, duration);
        } else {
            // Fallback nếu không có ParticleSystem
            setTimeout(() => {
                if (efxNode?.isValid) this.returnItem(efxNode);
            }, 1500);
        }
    }
}