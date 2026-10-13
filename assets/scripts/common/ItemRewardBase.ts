// @ts-nocheck
import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { GameResource } from '../datainfo/GameResource';
import { CURRENCY_TYPE, RESOURCE_TYPE, SPECIAL_RESOURCE_TYPE } from '../framework/constants';
import Utils from '../core/utils/Utils';
import { GameResourceConfigManager } from '../gameresource/GameResourceConfigManager';
import { MConfigResourceUtils } from '../framework/MConfigResourceUtils';
const { ccclass, property } = _decorator;

@ccclass('ItemRewardBase')
export class ItemRewardBase extends Component {
    gameResource: GameResource = null;

    @property(Node)
    nodeRewardValue:Node;

    @property(Label)
    txtValue: Label = null;

    @property(Label)
    txtValue_Shadow: Label = null;

    @property(Sprite)
    iconReward:Sprite;

    private setValueText(text: string): void {
        if (this.txtValue) this.txtValue.string = text;
        // txtValue_Shadow là node bóng đổ TUỲ CHỌN — không phải item reward nào cũng có/gán trong
        // Editor (vd ItemRewardReceive.prefab hiện chưa gán), guard để không crash lúc thiếu.
        if (this.txtValue_Shadow) this.txtValue_Shadow.string = text;
    }

    initItemReward(gameResource: GameResource) {
        this.gameResource = gameResource;
        this.iconReward.spriteFrame = null;
        this.nodeRewardValue.active = true;
        this.setValueText("");

        if (gameResource.Type == RESOURCE_TYPE.SPECIAL) {
            if (gameResource.SpecificType == SPECIAL_RESOURCE_TYPE.NOADS) {
                this.nodeRewardValue.active = false;
            }else if (gameResource.SpecificType == SPECIAL_RESOURCE_TYPE.INFINITE_LIFE) {
                this.nodeRewardValue.active = true;
                this.setValueText(`${Utils.getTimeStrByS_5(gameResource.Value.m_Value)}`);
            }
        } else {
            if (gameResource.Type == RESOURCE_TYPE.CURRENCY && gameResource.SpecificType == CURRENCY_TYPE.MONEY) {
                this.setValueText(`${gameResource.Value.m_Value}`);
            }
            else {
                this.setValueText(`x${gameResource.Value.m_Value}`);
            }
        }
        this.loadIconReward(gameResource);
    }



    loadIconReward(gameResource:GameResource = null){
        
    }
}


