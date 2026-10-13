// @ts-nocheck
import { _decorator, CCBoolean, Component, Node } from 'cc';
import { ItemLeaderboardGroupReward } from './ItemLeaderboardGroupReward';
import { GameResource } from '../datainfo/GameResource';
import { ItemLeaderboardEntryBase } from '../common/ItemLeaderboardEntryBase';
const { ccclass, property } = _decorator;

@ccclass('ItemLeaderboardEntryReward')
export class ItemLeaderboardEntryReward extends ItemLeaderboardEntryBase {
    @property(ItemLeaderboardGroupReward)
    groupReward: ItemLeaderboardGroupReward = null;

    initGroupReward(_rewards: GameResource[],_indexRankReward: number): void {
        this.groupReward.initReward(_rewards,_indexRankReward);
    }
}


