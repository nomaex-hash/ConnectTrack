// @ts-nocheck
import { _decorator, Component, Node, Tween, UIOpacity, Vec3 } from 'cc';
import { BasePopup } from '../common/BasePopup';
import { tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('BaseInfoPopup')
export class BaseInfoPopup extends BasePopup {
    @property(Node)
    nodeTitle:Node = null;

    indexNode: number = 0;

    @property(Node)
    arrInfoGroups:Node[] = [];

    tweenShow:Tween<{}> = null;

    @property(Node)
    groupTouchToClaim: Node = null;

    @property(UIOpacity)
    groupTouchToClaimOpacity: UIOpacity = null;

    tweenTouchToClaim: Tween<{}> = null;
    tweenTouchToClaimOpacity: Tween<{}> = null;
    tweenTouchToClaimScaleLoop: Tween<{}> = null;

    showInfoPopup(_cbWhenClose?: Function){
        super.showPopup(_cbWhenClose);

        this.nodeTitle.active = false;
        this.nodeTitle.setScale(new Vec3(0,0,0));
        for(let i = 0; i < this.arrInfoGroups.length; i ++){
            this.arrInfoGroups[i].active = false;
            this.arrInfoGroups[i].setScale(new Vec3(0,0,0));
        }
        this.btnClose.node.active = false;
        this.groupTouchToClaim.active = false;

        this.indexNode = 0;
        if(this.tweenShow != null){ 
            this.tweenShow.stop();
        }

        if(this.tweenTouchToClaim != null){
            this.tweenTouchToClaim.stop();
        }

        if(this.tweenTouchToClaimOpacity != null){
            this.tweenTouchToClaimOpacity.stop();
        }

        if(this.tweenTouchToClaimScaleLoop != null){
            this.tweenTouchToClaimScaleLoop.stop();
        }
    }

    showPoup_ShowView_Finished(): void {
        super.showPoup_ShowView_Finished();

        this.showTitle();
    }

    showTitle(){
        this.nodeTitle.active = true;
        this.nodeTitle.setScale(new Vec3(0,0,0));
        this.tweenShow = tween(this.nodeTitle).to(0.3, { scale: new Vec3(1, 1, 1) }, {
            easing: 'backOut', onComplete: () => {

            }
        }).delay(0.1).call(() => {
            this.showInfoGroup(0);
        }).start();
    }

    showInfoGroup(indexNode:number){
        this.indexNode = indexNode;
        this.arrInfoGroups[indexNode].active = true;
        this.arrInfoGroups[indexNode].setScale(new Vec3(0,0,0));
        this.tweenShow = tween(this.arrInfoGroups[indexNode]).to(0.3,{scale:new Vec3(1,1,1)},{easing:'backOut',onComplete:()=>{
            if(this.indexNode < this.arrInfoGroups.length - 1){
                this.showInfoGroup(this.indexNode + 1);
            }else{
                this.btnClose.node.active = true;
                this.btnClose.interactable = false;
                this.showTouchToContinue();
            }
        }}).start();
    }

    showTouchToContinue(): void {
        this.groupTouchToClaim.active = true;
        this.groupTouchToClaimOpacity.opacity = 0;
        this.groupTouchToClaim.setScale(new Vec3(0.5, 0.5, 0.5));
        this.tweenTouchToClaim = tween(this.groupTouchToClaim).to(0.5, { scale: new Vec3(1, 1, 1) }, {
            easing: 'backOut', onComplete: () => {
                this.setShowTouchToContinueFinished();
            }
        }).start();
        this.tweenTouchToClaimOpacity = tween(this.groupTouchToClaimOpacity).to(0.5, { opacity: 255 }).start();
    }

    setShowTouchToContinueFinished(){
        // console.log("setShowTouchToContinueFinished");
        this.btnClose.interactable = true;
        this.tweenTouchToClaimScaleLoop = tween(this.groupTouchToClaim).to(0.75,{scale: new Vec3(1.2,1.2,1.2)}, { easing: 'sineInOut',onComplete:()=>{}})
                                                                        .to(0.75,{scale: new Vec3(1,1,1)}, { easing: 'sineInOut',onComplete:()=>{}})
                                                                        .union().repeatForever().start();
    }

    hidePopup(): void {
        this.hidePopup_Finished();
    }

    hidePopup_Finished(): void {
        super.hidePopup_Finished();
        if (this.cbWhenClose) {
            this.cbWhenClose();
        }
    }
}


