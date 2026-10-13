// @ts-nocheck
import { _decorator, Component, Node, Vec3 } from 'cc';
import { ItemRewardBase } from '../common/ItemRewardBase';
import { GameResource } from '../datainfo/GameResource';
import { RESOURCE_TYPE } from '../framework/constants';
import { MConfigResourceUtils } from '../framework/MConfigResourceUtils';
import { GameResourceConfigManager } from '../gameresource/GameResourceConfigManager';
const { ccclass, property } = _decorator;

@ccclass('ItemRewardBoxSmall')
export class ItemRewardBoxSmall extends ItemRewardBase {
    @property(Node)
    bg: Node = null;

    initItemReward(gameResource: GameResource): void {
        super.initItemReward(gameResource);
        if(gameResource.Type == RESOURCE_TYPE.BOOSTER){
            this.bg.active = true;
        }else{
            this.bg.active = false;
        }

        if(this.gameResource.Type == RESOURCE_TYPE.BOOSTER){
            this.iconReward.node.setScale(new Vec3(0.4,0.4,0.4));
        }else if(this.gameResource.Type == RESOURCE_TYPE.SPECIAL){
            this.iconReward.node.setScale(new Vec3(0.7,0.7,0.7));
        }
    }

    loadIconReward(gameResource?: GameResource): void {
        super.loadIconReward(gameResource);
        if (gameResource) {
            let pathIcon: string = GameResourceConfigManager.instance.getPathIconGameResource(gameResource.Type, gameResource.SpecificType);
            MConfigResourceUtils.getGameResourceSpriteFrame(pathIcon,(err,spriteFrame)=>{
                if (err || !this.iconReward) {
                    return;
                }
                this.iconReward.spriteFrame = spriteFrame;
            });
        }
    }
}


