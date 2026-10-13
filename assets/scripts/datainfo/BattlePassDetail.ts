// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
import { BattlePassType } from '../framework/MConstants';
import { GameResource } from './GameResource';
const { ccclass, property } = _decorator;

@ccclass('BattlePassDetail')
export class BattlePassDetail {
    battlePassType:BattlePassType;
    rewardIndex:number;
    rewards:GameResource[] = [];
    isButton:boolean;
    icon:string;
}


