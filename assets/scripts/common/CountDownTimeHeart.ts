// @ts-nocheck

import { _decorator, Component, Label, Node } from 'cc';
import { FBInstantCommon_Callback } from './FBInstantManager';
import Utils from '../core/utils/Utils';
const { ccclass, property } = _decorator;

/**
 * Predefined variables
 * Name = CountDownTimeHeart
 * DateTime = Wed May 07 2025 14:44:21 GMT+0700 (Indochina Time)
 * Author = MoonMoon246
 * FileBasename = CountDownTimeHeart.ts
 * FileBasenameNoExtension = CountDownTimeHeart
 * URL = db://assets/scripts/common/CountDownTimeHeart.ts
 * ManualUrl = https://docs.cocos.com/creator/3.4/manual/en/
 *
 */
 
@ccclass('CountDownTimeHeart')
export class CountDownTimeHeart extends Component {
    @property(Label)
    txtCountDownTime: Label;

    countTime: number = 0;

    cb: FBInstantCommon_Callback = null;

    initTime(_time: number) {
        this.countTime = _time;
        this.txtCountDownTime.string = `${Utils.getTimeStrByS_HaveDay_Event(this.countTime)}`;
    }

    initCountDownTime(_time: number, _callback: FBInstantCommon_Callback) {
        this.cb = _callback;
        this.countTime = _time;
        this.txtCountDownTime.string = `${Utils.getTimeStrByS_HaveDay_Event(this.countTime)}`;
        this.unschedule(this.showTime);
        this.schedule(this.showTime, 1);
        this.node.active = true;
    }

    onDisable() {
        this.unschedule(this.showTime);
    }

    showTime() {
        this.countTime--;
        if (this.countTime > 0) {
            this.txtCountDownTime.string = `${Utils.getTimeStrByS_HaveDay_Event(this.countTime)}`;
        } else {
            this.countTime = 0;
            this.txtCountDownTime.string = `${Utils.getTimeStrByS_HaveDay_Event(this.countTime)}`;
            this.unschedule(this.showTime);

            this.cb!();
        }
    }
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
