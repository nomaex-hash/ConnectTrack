// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
import { LeaderBoardGroupBaseManager } from './LeaderBoardGroupBaseManager';
import { ItemRankInfo } from '../common/ItemRankInfo';
import { ItemLeaderboardEntryNormal } from './ItemLeaderboardEntryNormal';
const { ccclass, property } = _decorator;

@ccclass('LeaderBoardGroupNormalManager')
export class LeaderBoardGroupNormalManager extends LeaderBoardGroupBaseManager {
    

    initRankGroup(_arrItemRewardInfos: ItemRankInfo[]): void {
        super.initRankGroup(_arrItemRewardInfos);
        for (let i = 0; i < this.countShowItem; i++) {
            if (i < this.arrItemRankInfos.length) {
                let itemLeaderBoard: ItemLeaderboardEntryNormal = this.getItemLeaderBoard_Recycle_FromPools();
                if (!itemLeaderBoard) continue;
                itemLeaderBoard.node.setPosition(this.getPos_byIndex(i));
                itemLeaderBoard.init(this.arrItemRankInfos[i], 0.1 * i);
                itemLeaderBoard.setIndexPos(i);
                this.mapItemBoards.set(i, itemLeaderBoard);
            }
        }

        for (let i = 0; i < this.arrItemRankInfos.length; i++) {
            if (this.arrItemRankInfos[i].isMyRank) {
                if (this.myItemLeaderBoard) {
                    this.myItemLeaderBoard.init(this.arrItemRankInfos[i]);
                    this.myItemLeaderBoard.node.active = true;
                }
            }
        }

        if (this.indexMyRank > -1 && this.myItemLeaderBoard) {
            if (this.mapItemBoards.has(this.indexMyRank)) {
                this.isShowMyRank = false;
                this.myItemLeaderBoard.node.active = false;
            } else {
                this.isShowMyRank = true;
                this.myItemLeaderBoard.node.active = true;
            }
        }
    }

    updateItemRank(indexPos:number){
        super.updateItemRank(indexPos);
        let itemLeaderBoard: ItemLeaderboardEntryNormal = this.getItemLeaderBoard_Recycle_FromPools();
        if (!itemLeaderBoard) return;

        if(indexPos < this.arrItemRankInfos.length){
            itemLeaderBoard.node.setPosition(this.getPos_byIndex(indexPos));
            itemLeaderBoard.init(this.arrItemRankInfos[indexPos]);
            itemLeaderBoard.setIndexPos(indexPos);
            this.mapItemBoards.set(indexPos,itemLeaderBoard);
            itemLeaderBoard.node.active = true;
        }
    }
}


