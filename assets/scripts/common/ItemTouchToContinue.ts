// @ts-nocheck
import { _decorator, Component, Node, tween, Tween, UIOpacity, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ItemTouchToContinue')
export class ItemTouchToContinue extends Component {
    @property(Node)
    groupTouchToClaim: Node = null;
    @property(UIOpacity)
    groupTouchToClaimOpacity: UIOpacity = null;

    tweenTouchToClaim: Tween<{}> = null;
    tweenTouchToClaimOpacity: Tween<{}> = null;
    tweenTouchToClaimScaleLoop: Tween<{}> = null;


    resetItem(){
        if (!this.groupTouchToClaim) return;
        this.groupTouchToClaim.active = false;
        if(this.tweenTouchToClaim != null) this.tweenTouchToClaim.stop();
        if(this.tweenTouchToClaimOpacity != null) this.tweenTouchToClaimOpacity.stop();
        if(this.tweenTouchToClaimScaleLoop != null) this.tweenTouchToClaimScaleLoop.stop();
    }


    showItem(delayTime:number,cb?:Function){
        if (!this.groupTouchToClaim || !this.groupTouchToClaimOpacity) {
            if (cb != null) cb();
            return;
        }
        this.groupTouchToClaim.active = true;
        this.groupTouchToClaimOpacity.opacity = 0;
        this.groupTouchToClaim.setScale(new Vec3(0.5,0.5,0.5));
        this.tweenTouchToClaim = tween(this.groupTouchToClaim).delay(delayTime).to(0.8, { scale: new Vec3(1, 1, 1) }, {
            easing: 'backOut', onComplete: () => {
                if(cb != null) cb();
                this.scheduleOnce(()=>{
                   this.setShowItemFinished();
                },0.2);
            }
        }).start();
        this.tweenTouchToClaimOpacity = tween(this.groupTouchToClaimOpacity).delay(delayTime).to(0.5,{opacity:255}).start();
    }

    setShowItemFinished(){
        // Không còn nhấp nháy (phóng to/thu nhỏ lặp lại) sau khi hiện xong — nút "Nhận phần thưởng"
        // giữ nguyên scale 1 sau pop-in, theo yêu cầu bỏ hiệu ứng này.
    }
}
