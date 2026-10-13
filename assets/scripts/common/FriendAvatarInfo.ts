// @ts-nocheck

import { _decorator, Component, Node } from 'cc';
import { AVATAR_TYPE } from '../framework/constants';
const { ccclass, property } = _decorator;

/**
 * Predefined variables
 * Name = FriendAvatarInfo
 * DateTime = Wed Mar 02 2022 17:05:40 GMT+0700 (Indochina Time)
 * Author = tuzkekizer
 * FileBasename = FriendAvatarInfo.ts
 * FileBasenameNoExtension = FriendAvatarInfo
 * URL = db://assets/scripts/scene/play/FriendAvatarInfo.ts
 * ManualUrl = https://docs.cocos.com/creator/3.4/manual/en/
 *
 */
 
@ccclass('FriendAvatarInfo')
export class FriendAvatarInfo {
    id:string;
    type:AVATAR_TYPE;
    avatarUrl:string;
    name:string;
    level:number = 1;
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
