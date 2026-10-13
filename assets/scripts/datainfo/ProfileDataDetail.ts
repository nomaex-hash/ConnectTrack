// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
import { RequireToUnlock } from '../framework/MConstants';
const { ccclass, property } = _decorator;

@ccclass('ProfileDataDetail')
export class ProfileDataDetail {
    Id:number;
    requireToUnlock:RequireToUnlock;
    levelRequire:number;
    HowToCollect:string;
}


