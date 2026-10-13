// @ts-nocheck

import { _decorator, Component, Node, Sprite, UIOpacity, Vec3, Vec2, tween } from 'cc';
import { lodash } from '../framework/lodash';
import { localConfig } from '../localConfig';
import { configuration } from '../framework/configuration';
import { AudioManager2, SOUND_NAME } from '../framework/audioManager2';
import { clientEvent } from '../framework/clientEvent';
import { Constants } from '../framework/constants';
const { ccclass, property } = _decorator;

/**
 * Predefined variables
 * Name = ItemCoin
 * DateTime = Tue Feb 08 2022 09:12:50 GMT+0700 (Indochina Time)
 * Author = tuzkekizer
 * FileBasename = ItemCoin.ts
 * FileBasenameNoExtension = ItemCoin
 * URL = db://assets/scripts/scene/Item/ItemCoin.ts
 * ManualUrl = https://docs.cocos.com/creator/3.4/manual/en/
 *
 */
 
@ccclass('ItemCoin')
export class ItemCoin extends Component {
    // [1]
    // dummy = '';

    // [2]
    // @property
    // serializableDummy = 0;

    @property(Node)
    iconCoin:Node;

    @property(UIOpacity)
    iconCoin_UIOpacity:UIOpacity;

    start () {
        // [3]
    }

    // update (deltaTime: number) {
    //     // [4]
    // }

    targetPos:Vec3 = new Vec3(0,0,0);
    indexStar:number;
    coinValue:number;
    delayTimetoTagert:number;
    initCoin(_coinValue:number,_posStart:Vec3,_targetPos:Vec3,_delayTimeToTarget:number){
        this.coinValue = _coinValue; 
        this.targetPos = _targetPos;
        this.delayTimetoTagert = _delayTimeToTarget;
        // console.log("this.targetPos:"+this.targetPos);
        this.node.setPosition(_posStart);
        this.node.active = true;
        this.showCoin();
    }

    showCoin(){
        let self = this;
        this.iconCoin_UIOpacity.opacity = 0;
        this.node.setScale(new Vec3(0,0,0));
        tween(this.iconCoin_UIOpacity).to(0.2,{opacity: 255}, { easing: 'quadOut',onComplete:()=>{
            
        }}).start();

        tween(this.node).to(0.3,{scale: new Vec3(1,1,1),position:new Vec3(this.node.position.x + lodash.random(-80,80),this.node.position.y + lodash.random(-80,80),0)}, { easing: 'backOut',onComplete:()=>{
            self.moveToTarget();
        }}).start();
    }

    initCoin2(_coinValue:number,_posStart:Vec3,_targetPos:Vec3,_delayTimeToTarget:number){
        this.coinValue = _coinValue; 
        this.targetPos = _targetPos;
        this.delayTimetoTagert = _delayTimeToTarget;
        // console.log("this.targetPos:"+this.targetPos);
        this.node.setPosition(_posStart);
        this.node.active = true;
        this.showCoin2();
    }

    showCoin2(){
        let self = this;
        this.iconCoin_UIOpacity.opacity = 0;
        this.node.setScale(new Vec3(0,0,0));
        this.node.setRotationFromEuler(new Vec3(0,0,45));
        tween(this.iconCoin_UIOpacity).to(0.3,{opacity: 255}, { easing: 'quadOut',onComplete:()=>{
            
        }}).start();

        tween(this.node).to(0.3,{eulerAngles: new Vec3(0,0,0)}, { easing: 'bounceOut',onComplete:()=>{

        }}).start();

        tween(this.node).to(0.3,{scale: new Vec3(0.8,0.8,0.8)}, { easing: 'backOut',onComplete:()=>{
            self.moveToTarget();
        }}).start();
    }


    moveToTarget(){
        let self = this;
        // console.log("moveToTargetmoveToTarget");
        tween(this.node).delay(this.delayTimetoTagert).to(lodash.randomFloat(0.5,0.6),{position: this.targetPos}, { easing: 'quadOut',onComplete:()=>{
            self.node.active = false;
            // AudioManager2.instance.playSound(SOUND_NAME.COIN_RECEIVE);
            clientEvent.dispatchEvent(Constants.COIN_UPDATE,self.coinValue);
            const worldPos = self.node.getWorldPosition();
            clientEvent.dispatchEvent(Constants.SHOW_EFX_COIN_RECEIVE,worldPos);
        }}).start();

        tween(this.iconCoin_UIOpacity).delay(this.delayTimetoTagert).to(0.5,{opacity: 200}, { easing: 'linear',onComplete:()=>{
            
        }}).start();
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
