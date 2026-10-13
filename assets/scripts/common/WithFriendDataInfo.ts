// @ts-nocheck

import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Predefined variables
 * Name = WithFriendDataInfo
 * DateTime = Fri Mar 21 2025 17:04:07 GMT+0700 (Indochina Time)
 * Author = MoonMoon246
 * FileBasename = WithFriendDataInfo.ts
 * FileBasenameNoExtension = WithFriendDataInfo
 * URL = db://assets/scripts/game/withFriends/WithFriendDataInfo.ts
 * ManualUrl = https://docs.cocos.com/creator/3.4/manual/en/
 *
 */
 
@ccclass('WithFriendDataInfo')
export class WithFriendDataInfo {
    senderID:string = "";
    senderAvatarURL:string = "";
    senderName:string = "";
    senderScore:number = 0;
    
    receiverID:string = "";
    receiverAvatarURL:string = "";
    receiverName:string = "";
    receiverScore:number = 0;

    levelIndex:number = 0;
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
