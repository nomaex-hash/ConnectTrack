// @ts-nocheck

import { _decorator, Component, director, Node, tween } from 'cc';
import { localConfig } from '../localConfig';
import { configuration } from '../framework/configuration';
import { clientEvent } from '../framework/clientEvent';
import { Constants, CURRENCY_TYPE, RESOURCE_TYPE } from '../framework/constants';
import { GameResource } from '../datainfo/GameResource';
import { GameResourceConfigManager } from '../gameresource/GameResourceConfigManager';
const { ccclass, property } = _decorator;

/**
 * Predefined variables
 * Name = HeartManager
 * DateTime = Wed May 07 2025 11:42:25 GMT+0700 (Indochina Time)
 * Author = MoonMoon246
 * FileBasename = HeartManager.ts
 * FileBasenameNoExtension = HeartManager
 * URL = db://assets/scripts/common/HeartManager.ts
 * ManualUrl = https://docs.cocos.com/creator/3.4/manual/en/
 *
 */
 
@ccclass('HeartManager')
export class HeartManager extends Component {
    public static instance:HeartManager = null;
    protected onLoad(): void {
        director.addPersistRootNode(this.node);
        HeartManager.instance = this;
    }
    isCountDownHeart: boolean = false;

    HEART_TIME_RESET: number = 20 * 60;
    HEART_MAX_COUNT: number = 5;
    HEART_FULL_COST: GameResource = new GameResource(RESOURCE_TYPE.CURRENCY, CURRENCY_TYPE.MONEY, 800);

    currHeart: number = 0;
    currHeart_LastTime: number = 0;
    currHeart_CountTime: number = 0;

    currHeartUnlimited_CountTime: number = 0;
    currHeartUnlimited_LastTime: number = 0;

    protected onEnable(): void {
        clientEvent.on(Constants.HEART_COUNT_UPDATE,this.setChangeHeart,this);
        clientEvent.on(Constants.HEART_UNLIMITED_UPDATE,this.setAddHeartUnlimited,this);
        clientEvent.on(Constants.HEART_UNLIMITED_START,this.setAddHeartUnlimitedStart,this);
        clientEvent.on(Constants.HANDLE_LOSE_HEART, this.handleLoseHeart, this);
    }

    protected onDisable(): void {
        clientEvent.off(Constants.HEART_COUNT_UPDATE,this.setChangeHeart,this);
        clientEvent.off(Constants.HEART_UNLIMITED_UPDATE,this.setAddHeartUnlimited,this);
        clientEvent.off(Constants.HEART_UNLIMITED_START,this.setAddHeartUnlimitedStart,this);
        clientEvent.off(Constants.HANDLE_LOSE_HEART, this.handleLoseHeart, this);
    }

    initManager() {
        this.currHeart = GameResourceConfigManager.instance.getValueGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.LIFE);
        if (this.currHeart < 0) {
            this.currHeart = 0;
        }

        this.currHeart_LastTime = configuration.instance.getData_HeartLastTime();
        this.currHeartUnlimited_CountTime = configuration.instance.getData_HeartUnlimited();
        this.currHeartUnlimited_LastTime = configuration.instance.getData_HeartUnlimited_LastTime();

        // console.log("HeartManager initManager",this.currHeart,this.currHeart_LastTime,this.currHeart_CountTime);
        // console.log("HeartManager initManager Unlimited",this.currHeartUnlimited_CountTime,this.currHeartUnlimited_LastTime);
        this.initHeart();
        this.initHeartUnlimited();
    }

    initHeart() {
        if(this.currHeart >= this.HEART_MAX_COUNT) {
            
        }else{
            let countHeartAdd:number = Math.floor((localConfig.instance.getCurrTimeSecond() - this.currHeart_LastTime) / this.HEART_TIME_RESET);
            if(countHeartAdd > 0){
                this.currHeart += countHeartAdd;
                if(this.currHeart >= this.HEART_MAX_COUNT){
                    this.currHeart = this.HEART_MAX_COUNT;
                    this.currHeart_LastTime = localConfig.instance.getCurrTimeSecond();
                }else{
                    this.currHeart_LastTime += countHeartAdd * this.HEART_TIME_RESET;
                    this.currHeart_CountTime = this.HEART_TIME_RESET - (localConfig.instance.getCurrTimeSecond() - this.currHeart_LastTime);
                    this.schedule(this.scheduleHeart, 1);
                }
                configuration.instance.setData_HeartLastTime(this.currHeart_LastTime);
                // configuration.instance.setData_HeartCount(this.currHeart);
                // localConfig.instance.setGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.LIFE,this.currHeart);

                GameResourceConfigManager.instance.setGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.LIFE,this.currHeart);


                clientEvent.dispatchEvent(Constants.HEART_UPDATE);
            }else{
                this.currHeart_CountTime = this.HEART_TIME_RESET - (localConfig.instance.getCurrTimeSecond() - this.currHeart_LastTime);
                this.schedule(this.scheduleHeart, 1);
            }
        }

        
    }

    scheduleHeart(){
        if(this.currHeart_CountTime > 0){
            this.currHeart_CountTime -= 1;
            if(this.currHeart_CountTime == 0){
                this.currHeart_LastTime = localConfig.instance.getCurrTimeSecond();
                this.currHeart ++;


                this.unschedule(this.scheduleHeart);

                configuration.instance.setData_HeartLastTime(this.currHeart_LastTime);
                // localConfig.instance.setGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.LIFE,this.currHeart);

                GameResourceConfigManager.instance.setGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.LIFE,this.currHeart);
                if(this.currHeart >= this.HEART_MAX_COUNT){

                }else{
                    this.currHeart_CountTime = this.HEART_TIME_RESET;
                    this.schedule(this.scheduleHeart, 1);
                }

                clientEvent.dispatchEvent(Constants.HEART_UPDATE);
            }
        }
    }

    setChangeHeart(changeHeart: number) {
        if(changeHeart > 0){
            this.currHeart += changeHeart;
            // configuration.instance.setData_HeartCount(this.currHeart);
            // localConfig.instance.setGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.LIFE,this.currHeart);
            GameResourceConfigManager.instance.setGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.LIFE,this.currHeart);
            if(this.currHeart >= this.HEART_MAX_COUNT){
                this.currHeart = this.HEART_MAX_COUNT;
                this.currHeart_LastTime = localConfig.instance.getCurrTimeSecond();
                configuration.instance.setData_HeartLastTime(this.currHeart_LastTime);
            }
        }else{
            if(this.currHeartUnlimited_CountTime > 0){

            }else{
                if(this.currHeart == this.HEART_MAX_COUNT){
                    this.currHeart += changeHeart;
                    // configuration.instance.setData_HeartCount(this.currHeart);
                    // localConfig.instance.setGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.LIFE,this.currHeart);
                    GameResourceConfigManager.instance.setGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.LIFE,this.currHeart);
                    
                    this.currHeart_LastTime = localConfig.instance.getCurrTimeSecond();
                    this.currHeart_CountTime = this.HEART_TIME_RESET;
                    configuration.instance.setData_HeartLastTime(this.currHeart_LastTime);
                    this.schedule(this.scheduleHeart, 1);
                }else{
                    this.currHeart += changeHeart;
                    if(this.currHeart < 0){
                        this.currHeart = 0;
                    }
                    // configuration.instance.setData_HeartCount(this.currHeart);
                    // localConfig.instance.setGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.LIFE,this.currHeart);
                    GameResourceConfigManager.instance.setGameResource(RESOURCE_TYPE.CURRENCY,CURRENCY_TYPE.LIFE,this.currHeart);
                }
                
            }
        }

        clientEvent.dispatchEvent(Constants.HEART_UPDATE);
        
    }

    initHeartUnlimited() {
        this.currHeartUnlimited_CountTime =
            configuration.instance.getData_HeartUnlimited()
            - (localConfig.instance.getCurrTimeSecond() - configuration.instance.getData_HeartUnlimited_LastTime());

        if (this.currHeartUnlimited_CountTime <= 0) {
            this.currHeartUnlimited_CountTime = 0;
            configuration.instance.setData_HeartUnlimited(this.currHeartUnlimited_CountTime);
            configuration.instance.setData_HeartUnlimited_LastTime(localConfig.instance.getCurrTimeSecond());
        }

        if(this.currHeartUnlimited_CountTime > 0) {
            this.unschedule(this.scheduleHeartUnlimited);
            this.schedule(this.scheduleHeartUnlimited, 1);
        }
    }

    handleLoseHeart(){
        if(this.currHeartUnlimited_CountTime === 0){
            this.setChangeHeart(-1);
        }
    }

    scheduleHeartUnlimited() {
        if(this.currHeartUnlimited_CountTime > 0){
            this.currHeartUnlimited_CountTime -= 1;
            if(this.currHeartUnlimited_CountTime == 0){
                this.unschedule(this.scheduleHeartUnlimited);

                configuration.instance.setData_HeartUnlimited(this.currHeartUnlimited_CountTime);
                configuration.instance.setData_HeartUnlimited_LastTime(localConfig.instance.getCurrTimeSecond());
                
                clientEvent.dispatchEvent(Constants.HEART_UPDATE);
            }
        }
    }

    setAddHeartUnlimited() {
        // console.log("setAddHeartUnlimited");
        configuration.instance.setData_HeartUnlimited_LastTime(localConfig.instance.getCurrTimeSecond());
        this.initHeartUnlimited();

        clientEvent.dispatchEvent(Constants.HEART_UPDATE);
    }

    setAddHeartUnlimitedStart(gameResource: GameResource) {
        this.currHeartUnlimited_CountTime += gameResource.Value.m_Value;
        configuration.instance.setData_HeartUnlimited(this.currHeartUnlimited_CountTime);
        configuration.instance.setData_HeartUnlimited_LastTime(localConfig.instance.getCurrTimeSecond());
    }

    checkHeartAvailable() {
        if (this.currHeartUnlimited_CountTime > 0) {
            return true;
        } else {
            if (this.currHeart > 0) {
                return true;
            }
        }

        return false;
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
