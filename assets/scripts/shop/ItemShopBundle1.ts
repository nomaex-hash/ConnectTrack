// @ts-nocheck
import { _decorator, Component, instantiate, Label, Node, Prefab, Vec3 } from 'cc';
import { ItemBaseShopBundle } from './ItemBaseShopBundle';
import { BOOSTER_TYPE, Constants, CURRENCY_TYPE, RESOURCE_TYPE, SPECIAL_RESOURCE_TYPE } from '../framework/constants';
import Utils from '../core/utils/Utils';
import { clientEvent } from '../framework/clientEvent';
import { localConfig } from '../localConfig';
import { lodash } from '../framework/lodash';
import { ItemRewardShop } from './ItemRewardShop';
import { GameResourceConfigManager } from '../gameresource/GameResourceConfigManager';
import { LogEventManager } from '../common/LogEventManager';
import { DOGDOKU_BUNDLE_PACKAGE_ID_MAP } from './ItemBaseShopBundle';
const { ccclass, property } = _decorator;

@ccclass('ItemShopBundle1')
export class ItemShopBundle1 extends ItemBaseShopBundle {
    @property(Label)
    txtNamePackage: Label = null;

    @property(Label)
    txtNamePackage_Shadow: Label = null;

    @property(Label)
    txtCurrency_Money: Label = null;

    @property(Label)
    txtCurrency_Money_Shadow: Label = null;


    @property(Prefab)
    pfItemReward: Prefab = null;

    @property(Node)
    groupReward_Special: Node = null;

    @property(Node)
    groupReward_Booster: Node = null;

    arrItemRewardShops:ItemRewardShop[] = [];

    showInfo(): void {
        super.showInfo();
        if (!this.shopPackageDataConfig) return;

        if (this.txtNamePackage && this.txtNamePackage_Shadow) {
            this.txtNamePackage.string = this.txtNamePackage_Shadow.string = this.shopPackageDataConfig.packageNameToUI;
        }

        let gameResources = this.shopPackageDataConfig.GameResources;
        let currenyMoney = gameResources.find(x => x.Type == RESOURCE_TYPE.CURRENCY && x.SpecificType == CURRENCY_TYPE.MONEY);
        // Node "icon" (ảnh rương/xu trang trí) là anh em của txtCurrency_Money, cùng nằm trong
        // "groupAll" — không có field riêng nên tìm theo tên.
        const groupAll = this.txtCurrency_Money?.node.parent?.parent;
        const iconCurrency = groupAll?.getChildByName('icon');
        // Theo yêu cầu: luôn bật icon + text + shadow, không ẩn theo việc gói có coin hay không.
        if (this.txtCurrency_Money) {
            this.txtCurrency_Money.node.active = true;
            if (this.txtCurrency_Money_Shadow) this.txtCurrency_Money_Shadow.node.active = true;
            if (iconCurrency) iconCurrency.active = true;
            if (currenyMoney != null) {
                this.txtCurrency_Money.string = Utils.formatNumber_byFormatString(currenyMoney.Value.m_Value, " ");
                if (this.txtCurrency_Money_Shadow) this.txtCurrency_Money_Shadow.string = this.txtCurrency_Money.string;
            }
        }

        // Guard: pfItemReward chưa gắn component ItemRewardShop (chưa gắn trong Editor), hoặc
        // groupReward_Special/groupReward_Booster chưa gán field — bỏ qua dựng reward thay vì
        // crash cả item (đây là lý do icon hint/placeDog không hiện trước đó).
        if (!this.pfItemReward || !this.groupReward_Special || !this.groupReward_Booster) return;

        let gameResources_Temp = lodash.cloneDeep(gameResources);
        let gameResources_Special = gameResources_Temp.filter(x => x.Type == RESOURCE_TYPE.SPECIAL);

        if(localConfig.instance.isRemoveAd){
            //Remove phần tử RESOURCE_TYPE.SPECIAL && SPECIAL_RESOURCE_TYPE.NOADS
            gameResources_Special = gameResources_Special.filter(x => x.Type != RESOURCE_TYPE.SPECIAL || x.SpecificType != SPECIAL_RESOURCE_TYPE.NOADS);
        }

        let gameResources_Booster = gameResources_Temp.filter(x => x.Type == RESOURCE_TYPE.BOOSTER);

        this.groupReward_Special.removeAllChildren();
        this.groupReward_Booster.removeAllChildren();

        this.arrItemRewardShops = [];

        for(let i=0; i< gameResources_Special.length;i++){
            let item = instantiate(this.pfItemReward);
            item.parent = this.groupReward_Special;
            let itemRewardShop = item.getComponent(ItemRewardShop);
            if (!itemRewardShop) continue;
            itemRewardShop.initItemReward(gameResources_Special[i]);
            this.arrItemRewardShops.push(itemRewardShop);
        }

        for(let i=0; i< gameResources_Booster.length;i++){
            let item = instantiate(this.pfItemReward);
            item.parent = this.groupReward_Booster;
            let itemRewardShop = item.getComponent(ItemRewardShop);
            if (!itemRewardShop) continue;
            itemRewardShop.initItemReward(gameResources_Booster[i]);
            this.arrItemRewardShops.push(itemRewardShop);
        }
    }

    updateInfo(): void {
        super.updateInfo();
        for(let i=0; i< this.arrItemRewardShops.length;i++){
            let gameResource = this.arrItemRewardShops[i].gameResource;
            if(gameResource != null && gameResource.Type == RESOURCE_TYPE.SPECIAL && gameResource.SpecificType == SPECIAL_RESOURCE_TYPE.NOADS){
                if(localConfig.instance.isRemoveAd){
                    this.arrItemRewardShops[i].node.active = false;
                }
            }
        }
    }


    buyIAP_Success(): void {
        if (!this.shopPackageDataConfig) return;
        let gameResources = this.shopPackageDataConfig.GameResources;

        // Bundle hint/placeDog đã được GameManager.purchasePackage() cộng thẳng vào
        // PlayerData.inventory (xem ItemBaseShopBundle.touchBuy) — không cộng lại vào
        // GameResourceSaveData nữa, tránh 2 nguồn dữ liệu lệch nhau cho cùng 1 lượt mua.
        const isBridgedBundle = !!DOGDOKU_BUNDLE_PACKAGE_ID_MAP[this.shopPackageDataConfig.packageId];
        if (!isBridgedBundle && GameResourceConfigManager.instance) {
            //Save GameResources trước sau đó show reward receive
            for (let i = 0; i < gameResources.length; i++) {
                GameResourceConfigManager.instance.setGameResource(gameResources[i].Type, gameResources[i].SpecificType, GameResourceConfigManager.instance.getValueGameResource(gameResources[i].Type, gameResources[i].SpecificType) + gameResources[i].Value.m_Value);

                let resourceType = GameResourceConfigManager.instance.getStrResourceType(gameResources[i].Type);
                let resoruceName = GameResourceConfigManager.instance.getStrResourceName(gameResources[i].Type,gameResources[i].SpecificType);
                LogEventManager.instance?.logResourceEarned(resourceType, resoruceName, gameResources[i].Value.m_Value, localConfig.instance.getIAP_PlacementType(this.iapPlacementType), localConfig.instance.getIAP_ShowType(this.iapShowType));
            }
        }
        clientEvent.dispatchEvent(Constants.SHOW_REWARD_RECEIVE_POPUP,this.shopPackageDataConfig.packageNameToUI,gameResources,()=>{
            if (this.cbBuySuccess != null) {
                this.cbBuySuccess();
            }
        });
        super.buyIAP_Success();
    }
}


