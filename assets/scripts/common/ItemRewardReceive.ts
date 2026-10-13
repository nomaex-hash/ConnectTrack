// @ts-nocheck
import { _decorator, Component, Node, tween, Tween, UIOpacity, Vec3 } from 'cc';
import { ItemRewardBase } from './ItemRewardBase';
import { GameResource } from '../datainfo/GameResource';
import { Constants, CURRENCY_TYPE, RESOURCE_TYPE, SPECIAL_RESOURCE_TYPE } from '../framework/constants';
import { clientEvent } from '../framework/clientEvent';
import { GameResourceConfigManager } from '../gameresource/GameResourceConfigManager';
import { MConfigResourceUtils } from '../framework/MConfigResourceUtils';
const { ccclass, property } = _decorator;

@ccclass('ItemRewardReceive')
export class ItemRewardReceive extends ItemRewardBase {
    @property(Node)
    groupAll: Node = null;

    @property(UIOpacity)
    groupAllOpacity: UIOpacity = null;

    @property(Node)
    bg: Node = null;

    @property(Node)
    groupLight:Node;

    @property(UIOpacity)
    groupLightOpacity:UIOpacity;


    initItemReward(gameResource: GameResource,_delayTime:number = 0): void {
        super.initItemReward(gameResource);
        if (this.bg) {
            this.bg.active = gameResource.Type == RESOURCE_TYPE.BOOSTER;
        }

        this.showItem(_delayTime);
    }

    loadIconReward(gameResource?: GameResource): void {
        super.loadIconReward(gameResource);
        if (gameResource && GameResourceConfigManager.instance) {
            let pathIcon: string = GameResourceConfigManager.instance.getPathIconGameResourceBig(gameResource.Type, gameResource.SpecificType);
            MConfigResourceUtils.getGameResourceSpriteFrame(pathIcon, (err,spriteFrame) => {
                if (err || !this.iconReward) {
                    return;
                }
                this.iconReward.spriteFrame = spriteFrame;
            });
        }
    }

    tweenGroupAll:Tween<{}> = null;
    tweenGroupAllOpacity:Tween<{}> = null;
    showItem(_delayTime:number = 0){
        if (!this.groupAll || !this.groupAllOpacity || !this.groupLight) return;
        this.resetAllTween();
        this.groupAll.active = true;
        this.groupAll.setScale(new Vec3(0,0,0));
        this.groupAllOpacity.opacity = 0;
        this.groupLight.active = false;
        this.tweenGroupAll = tween(this.groupAll).delay(_delayTime).to(0.3,{scale:new Vec3(1,1,1)},{easing:'backOut',onComplete:()=>{
            this.showLight();
        }}).start();

        this.tweenGroupAllOpacity = tween(this.groupAllOpacity).delay(_delayTime).to(0.3,{opacity:255},{easing:'quadOut',onComplete:()=>{

        }}).start();
    }

    tweenGroupLight:Tween<{}> = null;
    tweenGroupLightOpacity:Tween<{}> = null;
    showLight(){
        if (!this.groupLight || !this.groupLightOpacity) return;

        this.groupLight.active = true;
        this.groupLight.setScale(new Vec3(0.5,0.5,0.5));
        this.groupLightOpacity.opacity = 0;
        this.tweenGroupLight = tween(this.groupLight).to(0.2,{scale:new Vec3(1,1,1)},{easing:'quadOut',onComplete:()=>{

        }}).start();

        this.tweenGroupLightOpacity = tween(this.groupLightOpacity).to(0.2,{opacity:255},{easing:'quadOut',onComplete:()=>{

        }}).start();
    }

    resetAllTween(){
        if(this.tweenGroupAll != null){
            this.tweenGroupAll.stop();
        }
        if(this.tweenGroupAllOpacity != null){
            this.tweenGroupAllOpacity.stop();
        }
        if(this.tweenGroupLight != null){
            this.tweenGroupLight.stop();
        }
        if(this.tweenGroupLightOpacity != null){
            this.tweenGroupLightOpacity.stop();
        }
        if(this.tweenMoveToTarget != null){
            this.tweenMoveToTarget.stop();
        }
    }

    hideItem(){
        if (!this.groupAll || !this.groupAllOpacity) return;
        this.resetAllTween();
        this.tweenGroupAll = tween(this.groupAll).to(0.2,{scale:new Vec3(0,0,0)},{easing:'quadOut',onComplete:()=>{
            this.node.active = false;
        }}).start();

        this.tweenGroupAllOpacity = tween(this.groupAllOpacity).to(0.2,{opacity:0},{easing:'quadOut',onComplete:()=>{

        }}).start();
    }

    hideGroupLight(_delayTime:number){
        if (!this.groupLight || !this.groupLightOpacity) return;
        this.tweenGroupLight = tween(this.groupLight).delay(_delayTime).to(0.2,{scale:new Vec3(0.5,0.5,0.5)},{easing:'quadOut',onComplete:()=>{
            this.groupLight.active = false;
        }}).start();

        this.tweenGroupLightOpacity = tween(this.groupLightOpacity).delay(_delayTime).to(0.2,{opacity:0},{easing:'quadOut',onComplete:()=>{

        }}).start();
    }

    setItemReward_Receive(_delayTimeToTarget:number,_targetWorldPos:Vec3){
        if(this.gameResource.Type == RESOURCE_TYPE.CURRENCY && this.gameResource.SpecificType == CURRENCY_TYPE.MONEY){
            this.hideItem();
            clientEvent.dispatchEvent(Constants.UPDATE_COIN_STARTPOS, this.node.worldPosition);
            clientEvent.dispatchEvent(Constants.SHOW_ADDCOIN, this.gameResource.Value.m_Value);
        }else{
            this.setMoveToTarget(_delayTimeToTarget,_targetWorldPos);
        }
    }

    tweenMoveToTarget:Tween<{}> = null;
    setMoveToTarget(_delayTimeToTarget:number,_targetWorldPos:Vec3){
        if (!this.groupAll || !this.groupAllOpacity) return;
        this.resetAllTween();
        this.groupAll.setScale(new Vec3(1,1,1));
        this.groupAllOpacity.opacity = 255;

        this.hideGroupLight(_delayTimeToTarget);
        this.tweenMoveToTarget = tween(this.node).delay(_delayTimeToTarget + 0.2).to(0.6,{worldPosition:_targetWorldPos},{easing:'quartIn',onComplete:()=>{

            this.setMoveToTarget_Finished();
        }}).start();

        this.tweenGroupAllOpacity = tween(this.groupAllOpacity).delay(_delayTimeToTarget + 0.2).to(0.6,{opacity:150},{easing:'linear',onComplete:()=>{

        }}).start();

        this.tweenGroupAll = tween(this.groupAll).delay(_delayTimeToTarget + 0.2).to(0.6,{scale:new Vec3(0.5,0.5,0.5)},{easing:'linear',onComplete:()=>{

        }}).start();
    }

    setMoveToTarget_Finished(){
        if(this.gameResource.Type == RESOURCE_TYPE.SPECIAL && this.gameResource.SpecificType == SPECIAL_RESOURCE_TYPE.INFINITE_LIFE){
            clientEvent.dispatchEvent(Constants.HEART_UNLIMITED_UPDATE,this.gameResource);
        }else if(this.gameResource.Type == RESOURCE_TYPE.BOOSTER){
            clientEvent.dispatchEvent(Constants.BOOSTER_UPDATE,this.gameResource);
        }
    }

}
