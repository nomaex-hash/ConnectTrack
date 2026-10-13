// @ts-nocheck
import { _decorator, Component, Enum, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MConstants')
export class MConstants {
    public static readonly LEVEL_CAN_SHOW_X2REWARD: number = 10;
    public static readonly LEVEL_CAN_CHANGE_SCENE_TO_LOBBY: number = 1;
    public static readonly LEVEL_START_SCENE_TO_LOBBY: number = 4;

    public static readonly LEVEL_CAN_SHOW_WIN: number = 4;
}