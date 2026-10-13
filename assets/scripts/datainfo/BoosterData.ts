// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
import { BOOSTER_TYPE } from '../framework/constants';
const { ccclass, property } = _decorator;

@ccclass('BoosterData')
export class BoosterData {
    BoosterType: BOOSTER_TYPE;
    BoosterName: string;
    Description: string;
    Price: number;
    Effect: number;
    UnlockLevel: number;
}


