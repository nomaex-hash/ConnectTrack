// @ts-nocheck
import { _decorator, Component, Node, Vec3 } from 'cc';
import { ItemRewardBase } from '../common/ItemRewardBase';
import { GameResource } from '../datainfo/GameResource';
import { RESOURCE_TYPE } from '../framework/constants';
import { GameResourceConfigManager } from '../gameresource/GameResourceConfigManager';
import { MConfigResourceUtils } from '../framework/MConfigResourceUtils';
const { ccclass, property } = _decorator;

@ccclass('ItemRewardShop')
export class ItemRewardShop extends ItemRewardBase {
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
            //nodeRewardValue position (24,-24,0)
            this.nodeRewardValue.setPosition(new Vec3(24,-24,0));
            this.iconReward.node.setScale(new Vec3(0.7,0.7,0.7));
        }else if(this.gameResource.Type == RESOURCE_TYPE.SPECIAL){
            //nodeRewardValue position (-20,-20,0)
            this.nodeRewardValue.setPosition(new Vec3(20,-20,0));
            this.iconReward.node.setScale(new Vec3(1.2,1.2,1.2));
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


