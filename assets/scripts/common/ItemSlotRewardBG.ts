// @ts-nocheck
import { _decorator, Component, Label, Node, Sprite, Vec3 } from 'cc';
import { GameResource } from '../datainfo/GameResource';
import { CURRENCY_TYPE, RESOURCE_TYPE, SPECIAL_RESOURCE_TYPE } from '../framework/constants';
import Utils from '../core/utils/Utils';
import { resourceUtil } from '../framework/resourceUtil';
import { localConfig } from '../localConfig';
import { GameResourceConfigManager } from '../gameresource/GameResourceConfigManager';
const { ccclass, property } = _decorator;

@ccclass('ItemSlotRewardBG')
export class ItemSlotRewardBG extends Component {
    @property(Sprite)
    icon:Sprite = null;

    @property(Label)
    txtCount:Label = null;
    initItemSlotReward(gameResource:GameResource){
        this.icon.spriteFrame = null;
        if(gameResource.Type == RESOURCE_TYPE.SPECIAL){
            this.txtCount.string = `${Utils.getTimeStrByS_5(gameResource.Value.m_Value)}`;
            if(gameResource.SpecificType == SPECIAL_RESOURCE_TYPE.NOADS){
                this.txtCount.node.active = false;
            }
        }else{
            this.txtCount.string = `x${gameResource.Value.m_Value}`;
        }
       
        if (gameResource) {
            if (gameResource.Type == RESOURCE_TYPE.CURRENCY && gameResource.SpecificType == CURRENCY_TYPE.MONEY) {
                let pathIcon: string = "gameresouces/currency_money_3";
                this.icon.node.setScale(0.9, 0.9, 1);
                resourceUtil.setSpriteFrame(pathIcon, this.icon, (err, spriteFrame) => {

                });
            } else {
                let pathIcon: string = GameResourceConfigManager.instance.getPathIconGameResourceSmall(gameResource.Type, gameResource.SpecificType);
                // console.log(pathIcon);
                // nếu là heart thì scale 0.7
                if(gameResource.Type == RESOURCE_TYPE.SPECIAL && gameResource.SpecificType == SPECIAL_RESOURCE_TYPE.INFINITE_LIFE){
                    this.icon.node.scale = new Vec3(0.9, 0.9, 1);
                }
                else{
                    this.icon.node.scale = new Vec3(1, 1, 1);
                }
                resourceUtil.setSpriteFrame(pathIcon, this.icon, (err, spriteFrame) => {

                });
            }
        }
    }
}


