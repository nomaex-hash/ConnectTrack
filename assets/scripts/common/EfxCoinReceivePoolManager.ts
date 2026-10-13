// @ts-nocheck
import { _decorator, Component, instantiate, Node, Prefab, Vec3 } from 'cc';
import { clientEvent } from '../framework/clientEvent';
import { Constants } from '../framework/constants';
import { ItemCoinEfxReceive } from './ItemCoinEfxReceive';
const { ccclass, property } = _decorator;

@ccclass('EfxCoinReceivePoolManager')
export class EfxCoinReceivePoolManager extends Component {
    static instance: EfxCoinReceivePoolManager;

    onLoad() {
        EfxCoinReceivePoolManager.instance = this;
    }
    @property(Prefab)
    itemCoinReceiveEfxPrefab: Prefab;

    @property(Node)
    poolParentNode: Node;

    arrPools:Node[] = [];

    protected onEnable(): void {
        clientEvent.on(Constants.SHOW_EFX_COIN_RECEIVE,this.showEfxCoinReceive,this);
    }

    protected onDisable(): void {
        clientEvent.off(Constants.SHOW_EFX_COIN_RECEIVE,this.showEfxCoinReceive,this);
    }

    showEfxCoinReceive(posWorld:Vec3) {
        let obj = this.getItem();
        obj.active = true;
        obj.setWorldPosition(posWorld);
        let itemCoinEfx:ItemCoinEfxReceive = obj.getComponent(ItemCoinEfxReceive);
        itemCoinEfx.showEfxCoinReceive();
    }

    getItem() {
        for (let i = 0; i < this.arrPools.length; i++) {
            if (!this.arrPools[i].active) {
                return this.arrPools[i];
            }
        }

        let obj = instantiate(this.itemCoinReceiveEfxPrefab);
        obj.parent = this.poolParentNode;
        this.arrPools.push(obj);
        return obj;
    }
}


