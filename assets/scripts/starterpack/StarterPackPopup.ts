// @ts-nocheck
import { _decorator, Button, Component, Enum, instantiate, Label, Node, Prefab } from 'cc';
import { BasePopup } from '../common/BasePopup';
import { Constants, ENV_TYPE, PackageName } from '../framework/constants';
import { ShopPackageDataConfig } from '../datainfo/ShopPackageDataConfig';
import { localConfig } from '../localConfig';
import { ItemSlotReward } from '../common/ItemSlotReward';
import { FBInstantManager } from '../common/FBInstantManager';
import { clientEvent } from '../framework/clientEvent';
import { ShopIAPManager } from '../shop/ShopIAPManager';
import { ItemSlotRewardBG } from '../common/ItemSlotRewardBG';
const { ccclass, property } = _decorator;

@ccclass('StarterPackPopup')
export class StarterPackPopup extends BasePopup {
    packageName: PackageName = PackageName.starterpack;

    shopPackageDataConfig: ShopPackageDataConfig = null;

    @property(Prefab)
    itemSlotRewardPrefab: Prefab = null;

    @property(Node)
    groupRewards1: Node = null;

    @property(Node)
    groupRewards2: Node = null;

    @property(Button)
    btnBuy: Button = null;

    @property(Label)
    txtPrice: Label = null;
    
    onLoad(): void {
        this.shopPackageDataConfig = localConfig.instance.getShopPackageDataConfig(this.packageName);
        // console.log("this.shopPackageDataConfig",this.shopPackageDataConfig);
        if (this.shopPackageDataConfig == null) {
            this.node.active = false;
            return;
        }
    }

    onEnable(): void {
        super.onEnable();
        this.btnBuy.node.on(Constants.CLICK, this.touchBuy, this);
    }

    onDisable(): void {
        super.onDisable();
        this.btnBuy.node.off(Constants.CLICK, this.touchBuy, this);
    }

    showStarterPackPopup() {
        super.showPopup();
    }

    start(): void {
        super.start();
        this.showInfo();
    }

    showInfo(){
        this.txtPrice.string = this.shopPackageDataConfig.price;
        for (let i = 0; i < this.shopPackageDataConfig.GameResources.length; i++) {
            let gameResource = this.shopPackageDataConfig.GameResources[i];
            let item = instantiate(this.itemSlotRewardPrefab);
            if( i< 4) {
                item.setParent(this.groupRewards1);
            }else{
                item.setParent(this.groupRewards2);
            }
            item.setPosition(0, 0, 0);
            let itemSlotReward = item.getComponent(ItemSlotRewardBG);
            itemSlotReward.initItemSlotReward(gameResource);
        }
    }


    touchBuy() {
        let self = this;
        if (localConfig.instance.envType == ENV_TYPE.TEST_AD) {
            const valueIAP: number = parseFloat(this.shopPackageDataConfig.price);
            ShopIAPManager.instance.addShopIAP(this.shopPackageDataConfig.packageId);
            this.buyIAP_Success();
            return;
        }
        let packID: string = this.shopPackageDataConfig.packageId;
        FBInstantManager.instance.getListIAP_Purchase((err: Error, success: string) => {
            if (err) {
                FBInstantManager.instance.buyIAP_consumePackID(this.shopPackageDataConfig, (err: Error, success: string) => {
                    if (err) {
                        clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "Buy Fail!");
                    } else {
                        clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "Buy Success!");
                        self.buyIAP_Success();
                    }
                });

            } else {
                let purchaseToken: string = FBInstantManager.instance.iap_checkPurchaseInfo(packID);
                if (purchaseToken != "") {
                    FBInstantManager.instance.iap_consumePackID(purchaseToken, (err: Error, success: string) => {
                        if (err) {
                            clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "Buy Fail!");
                        } else {
                            clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "Buy Success!");
                            self.buyIAP_Success();
                        }
                    });
                } else {
                    FBInstantManager.instance.buyIAP_consumePackID(this.shopPackageDataConfig, (err: Error, success: string) => {
                        if (err) {
                            clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "Buy Fail!");
                        } else {
                            clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "Buy Success!");
                            self.buyIAP_Success();
                        }
                    });
                }
            }
        });
    }

    buyIAP_Success() {
        clientEvent.dispatchEvent(Constants.SHOW_REWARD_RECEIVE_POPUP, this.shopPackageDataConfig.packageNameToUI, this.shopPackageDataConfig.GameResources, () => {
            // console.log("ItemShopBundle " + this.shopPackageDataConfig.packageNameToUI + " buyIAP_Success");
        });
        this.hidePopup();

    }
}


