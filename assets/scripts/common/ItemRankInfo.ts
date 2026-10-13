// @ts-nocheck

import { _decorator, Component, Node } from 'cc';
import { AVATAR_TYPE } from '../framework/constants';
const { ccclass, property } = _decorator;
 
@ccclass('ItemRankInfo')
export class ItemRankInfo {
    avatarType:AVATAR_TYPE = AVATAR_TYPE.TYPE_LOCAL;
    userName:string = "";
    userScore:number = 0;
    avatarURL:string = "1_1";
    isMyRank:boolean = false;
    indexRank:number = 1;
    idFB:string = "";
    playerID:string = "";
}