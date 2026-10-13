// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
import { SPECIAL_RESOURCE_TYPE } from '../framework/constants';
const { ccclass, property } = _decorator;

@ccclass('SpecialData')
export class SpecialData{
    BoosterType:SPECIAL_RESOURCE_TYPE;
    BoosterName:string;
    Description:string;
    Price:number;
    Effect:number;
    UnlockLevel:number;
    Time:number
}


