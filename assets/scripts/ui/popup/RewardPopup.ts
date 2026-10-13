import { _decorator, Label, Tween, UIOpacity, tween } from 'cc';
import { UIPopup } from '../UIPopup';

const { ccclass, property } = _decorator;

export interface RewardData {

    readonly placeDogCharges: number;
}


@ccclass('RewardPopup')
export class RewardPopup extends UIPopup<RewardData> {
    @property({ type: Label, tooltip: 'Nhãn số lượng quà, ví dụ "+3". Mẫu {n} = số lượng.' })
    amountLabel: Label | null = null;

    @property({ tooltip: 'Mẫu chữ số lượng. {n} sẽ được thay bằng số.' })
    amountFormat = '+{n}';

    @property({ tooltip: 'Popup vừa mở: thời gian mờ dần lên đậm (giây) — theo sau animation mở hộp quà.' })
    fadeInSeconds = 0.25;

    private opacity: UIOpacity | null = null;

    protected onShow(data: RewardData): void {
        // Không có bước tải nào — tắt loading NGAY (UIPopup.showLoading() tự bật lúc show()).
        this.hideLoading();
        if (this.amountLabel) {
            this.amountLabel.string = this.amountFormat.replace('{n}', `${data.placeDogCharges}`);
        }

        this.playFadeIn();
    }

    private playFadeIn(): void {
        if (!this.opacity || !this.opacity.isValid) {
            this.opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        }

        Tween.stopAllByTarget(this.opacity);
        this.opacity.opacity = 0;
        tween(this.opacity).to(this.fadeInSeconds, { opacity: 255 }).start();
    }

    onTapClaim(): void {
        this.requestClose();
    }
}
