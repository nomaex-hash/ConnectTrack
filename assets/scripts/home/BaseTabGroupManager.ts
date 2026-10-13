// @ts-nocheck
import { _decorator, Component, Node, tween, Tween, UIOpacity, UITransform } from 'cc';
import { TAB_TYPE } from '../framework/constants';
const { ccclass, property } = _decorator;

@ccclass('BaseTabGroupManager')
export class BaseTabGroupManager extends Component {
    @property({type: TAB_TYPE})
    tabType:TAB_TYPE = TAB_TYPE.HOME;

    @property(UIOpacity)
    groupOpacity: UIOpacity = null;

    @property(Node)
    contentGroup: Node = null;

    tweenOpacity:Tween<{}> = null;

    protected onEnable(): void {
        
    }

    protected onDisable(): void {
        
    }

    setShow(){

        if(this.tweenOpacity){
            this.tweenOpacity.stop();
        }
        this.contentGroup.active = true;
        this.tweenOpacity = tween(this.groupOpacity).to(0.2,{opacity:255},{easing:'linear',onComplete:()=>{}}).start();
    }

    setHide(){
        if(this.tweenOpacity){
            this.tweenOpacity.stop();
        }
        
        this.tweenOpacity = tween(this.groupOpacity).to(0.2,{opacity:0},{easing:'linear',onComplete:()=>{
            this.contentGroup.active = false;
        }}).start();
    }

    showGroup(){
    }


}


