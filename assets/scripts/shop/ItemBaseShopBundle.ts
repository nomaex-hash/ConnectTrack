// @ts-nocheck
import { _decorator, Button, Component, Enum, Label, Node } from 'cc';
import { Constants, ENV_TYPE, IAP_PLACEMENT_TYPE, IAP_SHOW_TYPE, PackageName, RESOURCE_TYPE, SPECIAL_RESOURCE_TYPE } from '../framework/constants';
import { ShopPackageDataConfig } from '../datainfo/ShopPackageDataConfig';
import { localConfig } from '../localConfig';
import { FBInstantManager } from '../common/FBInstantManager';
import { clientEvent } from '../framework/clientEvent';
import { AudioManager2 } from '../framework/audioManager2';
import { ShopIAPManager } from './ShopIAPManager';
import { GameManager } from '../manager/GameManager';
const { ccclass, property } = _decorator;

/**
 * Map packageId của shopData.json (kinh tế game gốc MagicSort) -> id thật trong
 * assets/scripts/config/ShopPackageDataConfig.ts (kinh tế Dogdoku: chỉ hintCharges/placeDogCharges).
 * Chỉ 6 bundle có mặt ở đây — packageId không nằm trong map (coin, battlepass...) vẫn đi theo
 * đường cũ (ShopIAPManager nội bộ), không đụng tới cho tới khi có quyết định riêng cho coin.
 */
export const DOGDOKU_BUNDLE_PACKAGE_ID_MAP: Readonly<Record<string, string>> = {
    starterbundle: 'starter_bundle',
    smallbundle: 'small_bundle',
    mediumbundle: 'medium_bundle',
    largebundle: 'large_bundle',
    bigbundle: 'big_bundle',
    megabundle: 'mega_bundle',
};

@ccclass('ItemBaseShopBundle')
export class ItemBaseShopBundle extends Component {
    @property({type:PackageName})
    packageName:PackageName = PackageName.None;

    @property({type:Enum(IAP_PLACEMENT_TYPE)})
    iapPlacementType:IAP_PLACEMENT_TYPE = IAP_PLACEMENT_TYPE.HOME_SHOP;

    @property({type:Enum(IAP_SHOW_TYPE)})
    iapShowType:IAP_SHOW_TYPE = IAP_SHOW_TYPE.SHOP;
    
    // Bản gốc dùng @property(Boolean) (constructor JS gốc) — Cocos 3.8.6 báo lỗi "type must be
    // CCBoolean, not Boolean" khi reload script (khác Cocos đời cũ dùng để viết code gốc). Bỏ
    // type hint, để Cocos tự suy ra boolean từ giá trị mặc định — tương đương, không đổi hành vi.
    @property
    isRevive: boolean = false;

    @property(Button)
    btnBuy: Button = null;

    @property(Label)
    txtPrice: Label = null;

    @property(Label)
    txtPrice_Shadow: Label = null;

    shopPackageDataConfig:ShopPackageDataConfig = null;

    cbBuySuccess:Function = null;

    protected onLoad(): void {
        this.shopPackageDataConfig = localConfig.instance.getShopPackageDataConfig(this.packageName);
        if(this.shopPackageDataConfig == null){
            this.node.active = false;
            return;
        }
    }
    protected onEnable(): void {
        // Guard: btnBuy null nếu chưa kéo field trong Inspector — trước đây crash ngay khi item
        // vừa bật (trước mọi tương tác), y hệt kiểu lỗi render mơ hồ (Batcher2D) gặp ở Shop.
        this.btnBuy?.node.on(Constants.CLICK,this.touchBuy,this);
        clientEvent.on(Constants.REMOVE_AD_UPDATE,this.showInfo,this);

    }

    protected onDisable(): void {
        this.btnBuy?.node.off(Constants.CLICK,this.touchBuy,this);
        clientEvent.off(Constants.REMOVE_AD_UPDATE,this.showInfo,this);
    }

    start () {
        this.showInfo();
    }

    initCallBackBuySuccess(cbBuySuccess:Function){
        this.cbBuySuccess = cbBuySuccess;
    }

    resetCallBackBuySuccess(){
        this.cbBuySuccess = null;
    }

    showInfo(){
        if (!this.shopPackageDataConfig) return;
        const price = this.shopPackageDataConfig.price;
        if (this.txtPrice) this.txtPrice.string = price;
        if (this.txtPrice_Shadow) this.txtPrice_Shadow.string = price;
    }

    updateInfo(){
        
    }

    touchBuy(){
        // console.log("touchBuy",PackageName[this.packageName]);

        let self = this;
        if(localConfig.instance.envType == ENV_TYPE.TEST_AD){
            const valueIAP: number = this.shopPackageDataConfig.price_amount_cents/ 100;

            // Bundle (hint/placeDog) -> đi qua GameManager.purchasePackage() thật của Dogdoku để
            // charges cộng vào PlayerData.inventory (nguồn dữ liệu gameplay thật sự đọc), thay vì
            // chỉ cộng vào GameResourceSaveData (kho riêng của framework gốc, gameplay không đọc).
            const dogdokuPackageId = DOGDOKU_BUNDLE_PACKAGE_ID_MAP[this.shopPackageDataConfig.packageId];
            if (dogdokuPackageId) {
                try {
                    GameManager.instance.purchasePackage(dogdokuPackageId).then(() => {
                        ShopIAPManager.instance.addShopIAP(self.shopPackageDataConfig.packageId);
                        self.buyIAP_Success();
                    }).catch((err: Error) => {
                        console.warn('[ItemBaseShopBundle] purchasePackage thất bại:', err);
                        clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION,"Buy Fail!");
                    });
                } catch (err) {
                    console.warn('[ItemBaseShopBundle] GameManager chưa khởi tạo:', err);
                    clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION,"Buy Fail!");
                }
                return;
            }

            ShopIAPManager.instance.addShopIAP(this.shopPackageDataConfig.packageId);
            this.buyIAP_Success();
            return;
        }
        let packID:string = this.shopPackageDataConfig.packageId;
        FBInstantManager.instance.getListIAP_Purchase((err:Error,success:string)=>{
            if(err){
                FBInstantManager.instance.buyIAP_consumePackID(this.shopPackageDataConfig,(err:Error,success:string)=>{
                    if(err){
                        clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION,"Buy Fail!");
                    }else{
                        clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION,"Buy Success!");
                        self.buyIAP_Success();
                    }
                });
                
            }else{
                let purchaseToken:string = FBInstantManager.instance.iap_checkPurchaseInfo(packID);
                if(purchaseToken != ""){
                    FBInstantManager.instance.iap_consumePackID(purchaseToken,(err:Error,success:string)=>{
                        if(err){
                            clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION,"Buy Fail!");
                        }else{
                            clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION,"Buy Success!");
                            self.buyIAP_Success();
                        }
                    });
                }else{
                    FBInstantManager.instance.buyIAP_consumePackID(this.shopPackageDataConfig,(err:Error,success:string)=>{
                        if(err){
                            clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION,"Buy Fail!");
                        }else{
                            clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION,"Buy Success!");
                            self.buyIAP_Success();
                        }
                    });
                }
            }
        });
    }

    buyIAP_Success(){
        ShopIAPManager.instance.addShopIAP(this.shopPackageDataConfig.packageId);
        let gameResources = this.shopPackageDataConfig.GameResources;
        for (let i = 0; i < gameResources.length; i++) {
            if (gameResources[i].Type == RESOURCE_TYPE.SPECIAL && gameResources[i].SpecificType == SPECIAL_RESOURCE_TYPE.NOADS) {
                localConfig.instance.setRemoveAd(true);
                clientEvent.dispatchEvent(Constants.REMOVE_AD_UPDATE);
            }else if(gameResources[i].Type == RESOURCE_TYPE.SPECIAL && gameResources[i].SpecificType == SPECIAL_RESOURCE_TYPE.INFINITE_LIFE){
                clientEvent.dispatchEvent(Constants.HEART_UNLIMITED_START,gameResources[i]);
            }
        }
    }
}


