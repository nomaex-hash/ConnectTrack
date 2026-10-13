// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
import { GameResource } from '../datainfo/GameResource';
const { ccclass, property } = _decorator;

@ccclass('LeaderboardReward')
export class LeaderboardReward {
    rewards:GameResource[] = [];
}
