// @ts-nocheck
import { _decorator, Button, Component, Node } from 'cc';
import { BaseTabGroupManager } from './BaseTabGroupManager';
import { Constants, PackageName } from '../framework/constants';
import { clientEvent } from '../framework/clientEvent';
import { ShopPackageDataConfig } from '../datainfo/ShopPackageDataConfig';
import { localConfig } from '../localConfig';
import { ShopIAPManager } from '../shop/ShopIAPManager';
import { ScrollViewVisibilityManager } from '../common/ScrollViewVisibilityManager';
const { ccclass, property } = _decorator;

@ccclass('ShopTabGroupManager')
export class ShopTabGroupManager extends BaseTabGroupManager {

    @property(Button)
    btnClose:Button = null;

    @property(Node)
    targetCoin:Node = null;

    @property(Node)
    targetHeart:Node = null;

    @property(Node)
    specialBanner:Node = null;

    @property(Node)
    specialGroup:Node = null;

    @property(Node)
    bundleBanner:Node = null;

    @property(Node)
    arrBundleGroup:Node[] = [];

    @property(Node)
    goldBanner:Node = null;

    @property(Node)
    arrGoldGroup:Node[] = [];

    @property(ScrollViewVisibilityManager)
    scrollViewVisibilityManager:ScrollViewVisibilityManager = null;

    protected onEnable(): void {
        super.onEnable();
        clientEvent.on(Constants.SHOP_IAP_UPDATE,this.setShopIAPUpdate,this);

        this.scheduleOnce(() => {

            if (this.targetCoin) clientEvent.dispatchEvent(Constants.UPDATE_COIN_TARGETPOS,this.targetCoin.worldPosition);
            if (this.targetHeart) clientEvent.dispatchEvent(Constants.UPDATE_HEART_TARGETPOS,this.targetHeart.worldPosition);
        }, 0);
    }

    protected onDisable(): void {
        super.onDisable();
        clientEvent.off(Constants.SHOP_IAP_UPDATE,this.setShopIAPUpdate,this);
    }


    showGroup(): void {
        super.showGroup();

        this.initShop();
    }

    initShop(){
 
        if (!ShopIAPManager.instance) return;
        let isStarterBundleBuyed: boolean = ShopIAPManager.instance.checkStarterPack_IsBuyed();
        if (this.specialBanner) this.specialBanner.active = !isStarterBundleBuyed;
        if (this.specialGroup) this.specialGroup.active = !isStarterBundleBuyed;
    }


    setShopIAPUpdate():void{
        this.initShop();
        this.scheduleOnce(() => {
            if (this.scrollViewVisibilityManager) this.scrollViewVisibilityManager.refreshItemsList();
        }, 0.2);
    }
    
}


