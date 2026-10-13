// @ts-nocheck

import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Predefined variables
 * Name = InfoDay
 * DateTime = Wed Jun 22 2022 11:21:32 GMT+0700 (Indochina Time)
 * Author = tuzkekizer
 * FileBasename = InfoDay.ts
 * FileBasenameNoExtension = InfoDay
 * URL = db://assets/scripts/calendar/InfoDay.ts
 * ManualUrl = https://docs.cocos.com/creator/3.4/manual/en/
 *
 */
 
@ccclass('InfoDay')
export class InfoDay {
    day:number = 1;
    month:number = 1;
    year:number = 2022;

    constructor(_day?: number, _month?: number, _year?: number){
        this.day = _day;
        this.month = _month;
        this.year = _year;
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
