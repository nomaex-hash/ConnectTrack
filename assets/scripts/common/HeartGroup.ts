// @ts-nocheck

import { _decorator, Button, Component, Label, Node, Sprite, SpriteFrame, tween, Tween, Vec3 } from 'cc';
// import { CountDownToNextTime } from '../common/CountDownToNextTime';
// import { CountDownTimeHeart } from '../common/CountDownTimeHeart';
import { clientEvent } from '../framework/clientEvent';
import { Constants } from '../framework/constants';
import { localConfig } from '../localConfig';
import { CountDownTimeHeart } from './CountDownTimeHeart';
import { HeartManager } from './HeartManager';
const { ccclass, property } = _decorator;

/**
 * Predefined variables
 * Name = HeartGroup
 * DateTime = Wed May 07 2025 14:39:36 GMT+0700 (Indochina Time)
 * Author = MoonMoon246
 * FileBasename = HeartGroup.ts
 * FileBasenameNoExtension = HeartGroup
 * URL = db://assets/scripts/game/HeartGroup.ts
 * ManualUrl = https://docs.cocos.com/creator/3.4/manual/en/
 *
 */
 
@ccclass('HeartGroup')
export class HeartGroup extends Component {
    @property(Sprite)
    iconHeart: Sprite;



    @property(SpriteFrame)
    sfHeartNormal: SpriteFrame;

    @property(SpriteFrame)
    sfHeartUnlimited: SpriteFrame;

    @property(Node)
    objHeartFull: Node;

    @property(Label)
    txtCountHeart: Label;

    @property(CountDownTimeHeart)
    countDownTimeHeart: CountDownTimeHeart;

    @property(CountDownTimeHeart)
    countDownTimeHeartUnlimited: CountDownTimeHeart;

    @property(Button)
    btnAdd:Button;

    @property(Node)
    iconAddHeart:Node;


    tweenUpdate:Tween<{}> = null;
    onLoad(){
        // Dogdoku không có hệ thống tim — HeartManager không (và không cần) gắn vào scene.
        // Tự tắt hẳn node này thay vì crash mỗi lần Shop mở (heartGroup tự active cùng Shop).
        if (!HeartManager.instance) {
            this.node.active = false;
            return;
        }
        if (this.iconHeart) {
            this.tweenUpdate = tween(this.iconHeart.node).to(0.1,{scale: new Vec3(1,1,1)},{easing:'linear'}).to(0.1,{scale: new Vec3(0.9,0.9,0.9)},{easing:'linear'}).union().repeat(3);
        }
    }

    onEnable(){
        if (!HeartManager.instance) return;
        clientEvent.on(Constants.HEART_UPDATE,this.heartUpdate,this);
        if(this.btnAdd){
            this.btnAdd.node.on(Constants.CLICK,this.touchAddHeart,this);
        }

        this.initInfo();
    }

    onDisable(){
        clientEvent.off(Constants.HEART_UPDATE,this.heartUpdate,this);
        if(this.btnAdd){
            this.btnAdd.node.off(Constants.CLICK,this.touchAddHeart,this);
        }
    }

    start () {
        // [3]

    }

    // update (deltaTime: number) {
    //     // [4]
    // }

    initInfo(){
        if (!HeartManager.instance || !this.countDownTimeHeart || !this.countDownTimeHeartUnlimited || !this.txtCountHeart || !this.objHeartFull || !this.iconHeart) return;
        this.countDownTimeHeart.node.active = false;
        this.countDownTimeHeartUnlimited.node.active = false;
        this.txtCountHeart.node.active = false;
        this.objHeartFull.active = false;
        if(this.iconAddHeart){
            this.iconAddHeart.active = false;
        }
        if(this.btnAdd){
            this.btnAdd.interactable = false;
        }
        
        if(HeartManager.instance.currHeartUnlimited_CountTime > 0){
            this.iconHeart.spriteFrame = this.sfHeartUnlimited;
            this.txtCountHeart.node.active = false;
            this.countDownTimeHeartUnlimited.node.active = true;
            this.countDownTimeHeartUnlimited.initCountDownTime(HeartManager.instance.currHeartUnlimited_CountTime,()=>{
                this.initInfo();
            });
            if(this.btnAdd){
                this.btnAdd.interactable = false;
            }
            if(this.iconAddHeart){
                this.iconAddHeart.active = false;
            }
        }else{
            if(HeartManager.instance.currHeart >= HeartManager.instance.HEART_MAX_COUNT){
                this.iconHeart.spriteFrame = this.sfHeartNormal;
                this.objHeartFull.active = true;
                this.txtCountHeart.string = `${HeartManager.instance.currHeart}`;
                this.txtCountHeart.node.active = false;
                this.countDownTimeHeart.node.active = false;
                if(this.btnAdd){
                    this.btnAdd.interactable = false;
                }
                if(this.iconAddHeart){
                    this.iconAddHeart.active = false;
                }
            }else{
                this.iconHeart.spriteFrame = this.sfHeartNormal;
                this.objHeartFull.active = false;
                this.txtCountHeart.string = `${HeartManager.instance.currHeart}`;
                this.txtCountHeart.node.active = true;
                this.countDownTimeHeart.node.active = true;
                this.countDownTimeHeart.initCountDownTime(HeartManager.instance.currHeart_CountTime,()=>{});
                if(this.btnAdd){
                    this.btnAdd.interactable = true;
                }
                if(this.iconAddHeart){
                    this.iconAddHeart.active = true;
                }
            }
        }
    }

    heartUpdate(){
        this.initInfo();
        if (this.tweenUpdate) {
            this.tweenUpdate.stop();
            this.tweenUpdate.start().call(()=>{
            });
        }
    }
    touchAddHeart(){
        clientEvent.dispatchEvent(Constants.SHOW_REFILLHEART_POPUP,()=>{});
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
