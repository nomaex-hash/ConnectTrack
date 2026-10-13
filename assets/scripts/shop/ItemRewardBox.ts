// @ts-nocheck
import { _decorator, Component, Node, Vec3 } from 'cc';
import { GameResource } from '../datainfo/GameResource';
import { ItemRewardBase } from '../common/ItemRewardBase';
import { RESOURCE_TYPE } from '../framework/constants';
import { GameResourceConfigManager } from '../gameresource/GameResourceConfigManager';
import { MConfigResourceUtils } from '../framework/MConfigResourceUtils';
const { ccclass, property } = _decorator;

@ccclass('ItemRewardBox')
export class ItemRewardBox extends ItemRewardBase {
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
            this.iconReward.node.setScale(new Vec3(0.7,0.7,0.7));
        }else if(this.gameResource.Type == RESOURCE_TYPE.SPECIAL){
            this.iconReward.node.setScale(new Vec3(1.2,1.2,1.2));
        }
    }

    loadIconReward(gameResource?: GameResource): void {
        super.loadIconReward(gameResource);
        if (gameResource) {
            let pathIcon: string = GameResourceConfigManager.instance.getPathIconGameResource(gameResource.Type, gameResource.SpecificType);
            MConfigResourceUtils.getGameResourceSpriteFrame(pathIcon,(err,spriteFrame)=>{
                // Guard .node (không chỉ check field null) — item này có thể đã bị destroy
                // (nodeRewardGroup.removeAllChildren() ở lần initGroup() kế tiếp) TRƯỚC KHI ảnh tải
                // xong (lần đầu vào game load chậm do chưa cache — xem preload ở
                // LeaderboardGroupWeek.showGroup()), gán spriteFrame lên Sprite đã destroy sẽ crash.
                if (err) {
                    console.warn('[ItemRewardBox] getGameResourceSpriteFrame lỗi cho path', pathIcon, err);
                    return;
                }
                if (!this.iconReward || !this.iconReward.node) {
                    return;
                }
                this.iconReward.spriteFrame = spriteFrame;
            });
        }
    }
}


