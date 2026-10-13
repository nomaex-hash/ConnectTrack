import { _decorator, Component, tween, Tween, Vec3 } from 'cc';
const { ccclass } = _decorator;

@ccclass('UIEffect')
export class UIEffect extends Component {
    private spinTween: Tween<{}> | null = null;

    // start() chỉ chạy ĐÚNG 1 LẦN trong suốt vòng đời component (kể cả khi node bị tắt/bật lại
    // nhiều lần sau đó) — trước đây dùng start() nên node bị ẩn/hiện lại (VD trong popup mở lại
    // lần 2) không quay nữa vì start() không bao giờ chạy lại. onEnable()/onDisable() thì CHẠY LẠI
    // mỗi lần node active thay đổi — đúng ý "mỗi lần hiện lại thì quay lại".
    onEnable(): void {
        Tween.stopAllByTarget(this.node);
        this.spinTween = tween(this.node)
            .by(10, { eulerAngles: new Vec3(0, 0, -360) })
            .repeatForever()
            .start();
    }

    onDisable(): void {
        if (this.spinTween) this.spinTween.stop();
        this.spinTween = null;
    }
}