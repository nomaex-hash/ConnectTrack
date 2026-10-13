// @ts-nocheck
import { _decorator, Component, Node, tween, Tween, UIOpacity, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ItemBaseScrollView')
export class ItemBaseScrollView extends Component {
    @property(Node)
    groupAll: Node = null;

    @property(UIOpacity)
    groupOpacity: UIOpacity = null;

    duration:number = 0.5;
    durationOpacity:number = 0.3;
    appearOffsetY:number = -50;

    /** vị trí gốc của groupAll (local) */
    private _originPos: Vec3 = new Vec3(0,0,0);

    protected onLoad(): void {
        this.setHideItem();
    }
    start() {

    }

    update(deltaTime: number) {
        
    }

    isShow:boolean = true;
    tweenShow:Tween<Node> | null = null;
    tweenOpacity:Tween<{}> | null = null;

    setShowItem(){
        if(this.isShow) return;
        this.isShow = true;
        this.groupAll.active = true;
        this.groupOpacity.opacity = 255;
        this.groupAll.setScale(new Vec3(1,1,1));
        this.groupAll.setPosition(this._originPos.x, this._originPos.y, this._originPos.z);
    }

    setShowItemWithTween(delay:number = 0){
        if(this.isShow) return;
        // console.log('setShowItemWithTween',this.node.name);
        this.isShow = true;
        if(this.tweenShow) this.tweenShow.stop();
        if(this.tweenOpacity) this.tweenOpacity.stop();
        this.groupAll.active = true;
        this.groupOpacity.opacity = 0;
        this.groupAll.setPosition(new Vec3(0,this.appearOffsetY,0));
        this.groupAll.setScale(new Vec3(0.8,0.8,0.8));
        this.tweenShow = tween(this.groupAll).delay(delay).to(this.duration,{position:this._originPos,scale: new Vec3(1,1,1)},{easing:'backOut',onComplete:()=>{}}).start();
        this.tweenOpacity = tween(this.groupOpacity).delay(delay).to(this.durationOpacity,{opacity:255},{easing:'quadOut',onComplete:()=>{}}).start();
    }

    setHideItem(){
        if(!this.isShow) return;
        // console.log('setHideItem',this.node.name);
        if(this.tweenShow) this.tweenShow.stop();
        if(this.tweenOpacity) this.tweenOpacity.stop();
        this.isShow = false;
        this.groupAll.active = false;
        this.groupOpacity.opacity = 0;
        this.groupAll.setPosition(new Vec3(0,this.appearOffsetY,0));
        this.groupAll.setScale(new Vec3(0.8,0.8,0.8));
    }


}


