// @ts-nocheck
import { _decorator, CCBoolean, Component, instantiate, Node, Prefab, Sprite, SpriteFrame } from 'cc';
import { GameResource } from '../datainfo/GameResource';
import { ItemRewardBox } from '../shop/ItemRewardBox';
import { Constants } from '../framework/constants';
import { clientEvent } from '../framework/clientEvent';
const { ccclass, property } = _decorator;

@ccclass('ItemLeaderboardGroupReward')
export class ItemLeaderboardGroupReward extends Component {
    @property(Sprite)
    iconBox: Sprite = null;

    @property(SpriteFrame)
    arrSfIconBox: SpriteFrame[] = [];


    @property(Prefab)
    itemRewardPrefab: Prefab = null;

    @property(Node)
    contentReward: Node = null;

    @property(Node)
    parentDetailRewardGroup:Node;

    gameResources: GameResource[] = null;
    indexRankReward: number = 0;
    
    @property(CCBoolean)
    isMyItemLeadboardReward:boolean = false;

    protected onEnable(): void {
        this.iconBox.node.on(Constants.CLICK, this.onTouchDetailReward, this);
    }

    protected onDisable(): void {
        this.iconBox.node.off(Constants.CLICK, this.onTouchDetailReward, this);
    }

    initReward(_gameResources: GameResource[],_indexRankReward: number): void {
        this.gameResources = _gameResources;
        this.indexRankReward = _indexRankReward;
        this.contentReward.removeAllChildren();
        this.iconBox.node.active = false;
       
        if(!_gameResources) return;
        if(!this.itemRewardPrefab || !this.contentReward) return;
        this.node.active = true;
       
        if(this.indexRankReward < this.arrSfIconBox.length){
            this.iconBox.node.active = true;
            this.iconBox.spriteFrame = this.arrSfIconBox[this.indexRankReward];
        }else{
            let countReward: number = this.gameResources.length;
            if(countReward >= 2){
                this.iconBox.node.active = true;
                this.iconBox.spriteFrame = this.arrSfIconBox[this.arrSfIconBox.length - 1];
            }else{
                this.iconBox.node.active = false;
                if (!this.itemRewardPrefab || !this.contentReward) return;
                const item = instantiate(this.itemRewardPrefab);
                item.setParent(this.contentReward);
                let itemRewardBox = item.getComponent(ItemRewardBox);
                itemRewardBox?.initItemReward(this.gameResources[0]);
            }
        }
    }

    onTouchDetailReward(){
        clientEvent.dispatchEvent(Constants.LEADERBOARD_SHOW_DETAIL_REWARD,this);
    }
}


