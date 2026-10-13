// @ts-nocheck

import { _decorator, Component, Node, Label, Tween, tween, Vec3, Button } from 'cc';
import { clientEvent } from '../framework/clientEvent';
import { Constants, CURRENCY_TYPE, RESOURCE_TYPE, SCENE_TYPE } from '../framework/constants';
import { localConfig } from '../localConfig';
import Utils from '../core/utils/Utils';
import { GameResourceConfigManager } from '../gameresource/GameResourceConfigManager';
const { ccclass, property } = _decorator;

@ccclass('CoinGroup')
export class CoinGroup extends Component {
    // [1]
    // dummy = '';

    // [2]
    // @property
    // serializableDummy = 0;
    @property(Label)
    txtCoin: Label;

    @property(Node)
    iconCoin: Node;

    @property(Button)
    btnAddCoin: Button;

    currCoin: number = 0;
    tweenCoinUpdate: Tween<{}> = null;
    onLoad() {
        // Guard: iconCoin/btnAddCoin/txtCoin null nếu chưa kéo field trong Inspector — trước đây
        // crash ngay khi node coinGroup vừa tạo (trước mọi tương tác).
        if (this.iconCoin) {
            this.tweenCoinUpdate = tween(this.iconCoin).to(0.1, { scale: new Vec3(1.1, 1.1, 1.1) }, { easing: 'linear' }).to(0.1, { scale: new Vec3(1, 1, 1) }, { easing: 'linear' }).union().repeat(3);
        }
    }

    onEnable() {
        clientEvent.on(Constants.COIN_UPDATE, this.coinUpdate, this);
        this.btnAddCoin?.node.on(Constants.CLICK, this.touchAddCoin, this);

        // console.log("localConfig.instance.currCoin:"+localConfig.instance.currCoin);
        if (!GameResourceConfigManager.instance) return;
        this.currCoin = GameResourceConfigManager.instance.getValueGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.MONEY);
        if (this.txtCoin) this.txtCoin.string = `${Math.floor(this.currCoin)}`;
    }

    onDisable() {
        clientEvent.off(Constants.COIN_UPDATE, this.coinUpdate, this);
        this.btnAddCoin?.node.off(Constants.CLICK, this.touchAddCoin, this);
    }

    start() {
        // [3]
        // this.txtCoin.string = `${localConfig.instance.currCoin}`;
    }

    // update (deltaTime: number) {
    //     // [4]
    // }

    setPreReceiveLevelReward(coinReward: number) {
        this.currCoin = this.currCoin - coinReward;
        this.txtCoin.string = `${Math.floor(this.currCoin)}`;
    }

    coinUpdate(addCoin: number) {
        if (!GameResourceConfigManager.instance) return;
        this.currCoin = this.currCoin + addCoin;
        let currCoinValue = GameResourceConfigManager.instance.getValueGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.MONEY);
        if(this.currCoin > currCoinValue){
            this.currCoin = currCoinValue;
        }
        if (this.txtCoin) {
            this.txtCoin.string = `${Math.floor(this.currCoin)}`;
            this.txtCoin.node.setScale(new Vec3(1, 1, 1));
        }
        if (this.tweenCoinUpdate) {
            this.tweenCoinUpdate.stop();
            this.tweenCoinUpdate.start().call(() => {
                this.txtCoin?.node.setScale(new Vec3(1, 1, 1));
            });
        }
    }

    touchAddCoin() {
        if(localConfig.instance.currSceneType == SCENE_TYPE.HOME){
            clientEvent.dispatchEvent(Constants.SHOW_SHOP_GROUP);
        }else{
            clientEvent.dispatchEvent(Constants.SHOW_SHOP_POPUP);
        }
    }
}

/**
 * [1] Class member could be defined like this.
 * [2] Use `property` decorator if your want the member to be serializable.
 * [3] Your initialization goes here.
 * [4] Your update function goes here.
 *
 * Learn more about scripting: https://docs.cocos.com/creator/3.0/manual/en/scripting/
 * Learn more about CCClass: https://docs.cocos.com/creator/3.0/manual/en/scripting/ccclass.html
 * Learn more about life-cycle callbacks: https://docs.cocos.com/creator/3.0/manual/en/scripting/life-cycle-callbacks.html
 */
