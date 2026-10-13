import { _decorator, Component, macro, Node, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('IconLoading2')
export class IconLoading2 extends Component {
    rotationIndex = 0;
    start() {
        
    }

    protected onEnable(): void {
         this.rotationIndex = 0;
        this.schedule(this.setIconRotation, 0.05, macro.REPEAT_FOREVER);
    }

    protected onDisable(): void {
        this.unschedule(this.setIconRotation);
    }
    public setIconRotation() {
        this.rotationIndex += 1;
        if (this.rotationIndex >= 8) {
            this.rotationIndex = 0;
        }
        this.node.eulerAngles = new Vec3(0, 0, this.rotationIndex * 45);
    }
}


