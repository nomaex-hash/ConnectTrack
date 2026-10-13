// @ts-nocheck
import { _decorator, Component, game, Label, Node, Sprite, Vec3 } from 'cc';
import { BattlePassDetail } from '../datainfo/BattlePassDetail';
import { resourceUtil } from '../framework/resourceUtil';
import { GameResource } from '../datainfo/GameResource';
import { CURRENCY_TYPE, RESOURCE_TYPE, SPECIAL_RESOURCE_TYPE } from '../framework/constants';
import { localConfig } from '../localConfig';
import Utils from '../core/utils/Utils';
import { GameResourceConfigManager } from '../gameresource/GameResourceConfigManager';
const { ccclass, property } = _decorator;

@ccclass('ItemSlotReward')
export class ItemSlotReward extends Component {
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
            if(gameResource.Type == RESOURCE_TYPE.CURRENCY && gameResource.SpecificType == CURRENCY_TYPE.MONEY){
                this.txtCount.string = `${gameResource.Value.m_Value}`;
            }
            else{
                this.txtCount.string = `x${gameResource.Value.m_Value}`;
            }
        }
    
        if (gameResource) {
            if (gameResource.Type == RESOURCE_TYPE.CURRENCY && gameResource.SpecificType == CURRENCY_TYPE.MONEY) {
                let pathIcon: string = "gameresouces/currency_money_3";
                this.icon.node.setScale(0.7, 0.7, 1);
                resourceUtil.setSpriteFrame(pathIcon, this.icon, (err, spriteFrame) => {

                });
            } else {
                let pathIcon: string = GameResourceConfigManager.instance.getPathIconGameResourceSmall(gameResource.Type, gameResource.SpecificType);
                // console.log(pathIcon);
                // nếu là heart thì scale 0.7
                if(gameResource.Type == RESOURCE_TYPE.SPECIAL
                    && (gameResource.SpecificType == SPECIAL_RESOURCE_TYPE.INFINITE_LIFE
                    || gameResource.SpecificType == SPECIAL_RESOURCE_TYPE.NOADS)
                ){
                    this.icon.node.scale = new Vec3(0.7, 0.7, 1);
                }
                else{
                    this.icon.node.scale = new Vec3(0.8, 0.8, 1);
                }
                resourceUtil.setSpriteFrame(pathIcon, this.icon, (err, spriteFrame) => {

                });
            }
        }
    }
}


