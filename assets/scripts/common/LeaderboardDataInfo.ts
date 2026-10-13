// @ts-nocheck

import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Predefined variables
 * Name = LeaderboardDataInfo
 * DateTime = Thu Oct 17 2024 11:07:06 GMT+0700 (Indochina Time)
 * Author = MoonMoon246
 * FileBasename = LeaderboardDataInfo.ts
 * FileBasenameNoExtension = LeaderboardDataInfo
 * URL = db://assets/scripts/common/LeaderboardDataInfo.ts
 * ManualUrl = https://docs.cocos.com/creator/3.4/manual/en/
 *
 */
 
@ccclass('LeaderboardDataInfo')
export class LeaderboardDataInfo {
    _id:string = "";
    tournamentId:string;
    contextId:string;
    expireTime:number;
    name:string;
    levelIndex:number;
}

/**
 * [1] Class member could be defined like this.
 * [2] Use `property` decorator if your want the member to be serializable.
 * [3] Your initialization goes here.
 * [4] Your update function goes here.
 *
 * Learn more about scripting: https://docs.cocos.com/creator/3.4/manual/en/scripting/
 * Learn more about CCClass: https://docs.cocos.com/creator/3.4/manual/en/scripting/ccclass.html
 * Learn more about life-cycle callbacks: https://docs.cocos.com/creator/3.4/manual/en/scripting/life-cycle-callbacks.html
 */
