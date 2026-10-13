// @ts-nocheck
import { _decorator, Component, Label, Node } from 'cc';
import { ItemBaseShopBundle } from './ItemBaseShopBundle';
import { Constants, CURRENCY_TYPE, RESOURCE_TYPE, SPECIAL_RESOURCE_TYPE } from '../framework/constants';
import { LogEventManager } from '../common/LogEventManager';
import { localConfig } from '../localConfig';
import { clientEvent } from '../framework/clientEvent';
import { GameResourceConfigManager } from '../gameresource/GameResourceConfigManager';
import Utils from '../core/utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('ItemShopGold')
export class ItemShopGold extends ItemBaseShopBundle {
    @property(Label)
    txtCurrency_Money: Label = null;

    @property(Label)
    txtCurrency_Money_Shadow: Label = null;

    @property(Node)
    goldStartPos: Node = null;

    showInfo(): void {
        super.showInfo();
        if (!this.shopPackageDataConfig) return;
        let gameResources = this.shopPackageDataConfig.GameResources;
        let currenyMoney = gameResources.find(x => x.Type == RESOURCE_TYPE.CURRENCY && x.SpecificType == CURRENCY_TYPE.MONEY);
        if (!this.txtCurrency_Money || !this.txtCurrency_Money_Shadow) return;
        if (currenyMoney != null) {
            this.txtCurrency_Money.node.active = true;
            this.txtCurrency_Money_Shadow.node.active = true;
            this.txtCurrency_Money.string = this.txtCurrency_Money_Shadow.string = Utils.formatNumber_byFormatString(currenyMoney.Value.m_Value, " ");
        } else {
            this.txtCurrency_Money.node.active = false;
            this.txtCurrency_Money_Shadow.node.active = false;
        }
    }

    buyIAP_Success(): void {
        if (!this.shopPackageDataConfig) return;
        let gameResources = this.shopPackageDataConfig.GameResources;
        for (let i = 0; i < gameResources.length; i++) {
            if (gameResources[i].Type == RESOURCE_TYPE.CURRENCY && gameResources[i].SpecificType == CURRENCY_TYPE.MONEY) {
                if (this.goldStartPos) clientEvent.dispatchEvent(Constants.UPDATE_COIN_STARTPOS,this.goldStartPos.worldPosition);
                clientEvent.dispatchEvent(Constants.SHOW_ADDCOIN,gameResources[i].Value.m_Value);
                GameResourceConfigManager.instance.setGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.MONEY,GameResourceConfigManager.instance.getValueGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.MONEY) + gameResources[i].Value.m_Value);
                let resourceType = GameResourceConfigManager.instance.getStrResourceType(gameResources[i].Type);
                let resoruceName = GameResourceConfigManager.instance.getStrResourceName(gameResources[i].Type,gameResources[i].SpecificType);
                LogEventManager.instance.logResourceEarned(resourceType,resoruceName,gameResources[i].Value.m_Value,localConfig.instance.getIAP_PlacementType(this.iapPlacementType),localConfig.instance.getIAP_ShowType(this.iapShowType));
            }
        }
        super.buyIAP_Success();
    }
}


