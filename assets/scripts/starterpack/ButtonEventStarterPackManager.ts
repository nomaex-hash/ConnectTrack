// @ts-nocheck
import { _decorator, Button, Component, Node } from 'cc';
import { Constants, PackageName } from '../framework/constants';
import { clientEvent } from '../framework/clientEvent';
import { CountDownTimeEvent } from '../common/CountDownTimeEvent';
import { ShopIAPManager } from '../shop/ShopIAPManager';
import { ShopPackageDataConfig } from '../datainfo/ShopPackageDataConfig';
import { localConfig } from '../localConfig';
import { FBInstantManager } from '../common/FBInstantManager';
const { ccclass, property } = _decorator;

@ccclass('ButtonEventStarterPackManager')
export class ButtonEventStarterPackManager extends Component {
    @property(Button)
    btnBuy: Button = null;

    packageName: PackageName = PackageName.starterpack;

    @property(CountDownTimeEvent)
    countTimeEvent: CountDownTimeEvent = null;

    protected onEnable(): void {
        this.btnBuy.node.on(Constants.CLICK, this.touchBuy, this);
        clientEvent.on(Constants.SHOP_IAP_UPDATE, this.showInfo, this);
        clientEvent.on(Constants.IAP_INIT_SUCCESS, this.showInfo, this);
        this.showInfo();
    }

    protected onDisable(): void {
        this.btnBuy.node.off(Constants.CLICK, this.touchBuy, this);
        clientEvent.off(Constants.SHOP_IAP_UPDATE, this.showInfo, this);
        clientEvent.off(Constants.IAP_INIT_SUCCESS, this.showInfo, this);
    }

    protected onDestroy(): void {
        clientEvent.setTargetOff(this);
    }
    start() {

    }

    showInfo() {
        let starterPackInfo:ShopPackageDataConfig = localConfig.instance.getShopPackageDataConfig(PackageName.starterpack);
        if(!FBInstantManager.instance.checkHaveIAPPack_byProductID(starterPackInfo.packageId)){
            this.node.active = false;
            return;
        }
        let checkStarterPackBuyed: boolean = ShopIAPManager.instance.checkStarterPack_IsBuyed();
        if(checkStarterPackBuyed) {
            this.node.active = false;
            return;
        }
        let countTimeLeft:number = ShopIAPManager.instance.getStarterPackTimeLeft();
        if(countTimeLeft > 0){
            this.countTimeEvent.node.active = true;
            this.countTimeEvent.initCountDownTime(countTimeLeft, () => {
                this.node.active = false;
            });
        }else{
            this.countTimeEvent.node.active = false;
            this.node.active = false;
        }
    }

    touchBuy() {
        // console.log("touchBuy");
        clientEvent.dispatchEvent(Constants.SHOW_STARTER_PACK_POPUP);
    }
}


