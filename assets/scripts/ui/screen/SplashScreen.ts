import { _decorator, Component, tween, UIOpacity } from 'cc';
import { AppState } from '../../core/AppState';
import { EventManager } from '../../core/EventManager';
import {
    APP_STATE_CHANGED_EVENT,
    AppStateChangedEventPayload,
} from '../../event/AppStateChangedEvent';

const { ccclass, property } = _decorator;

@ccclass('SplashScreen')
export class SplashScreen extends Component {
    @property({ tooltip: 'Thời gian tối thiểu hiển thị logo (giây) để tránh chớp nháy trên máy nhanh' })
    minDisplaySeconds = 1.2;

    private opacity: UIOpacity | null = null;
    private bootCompleted = false;
    private minTimeElapsed = false;

    onLoad(): void {
        this.opacity = this.getComponent(UIOpacity) ?? this.addComponent(UIOpacity);
        EventManager.instance.on<AppStateChangedEventPayload>(
            APP_STATE_CHANGED_EVENT,
            this.onAppStateChanged,
            this,
        );
    }

    start(): void {
        this.scheduleOnce(() => {
            this.minTimeElapsed = true;
            this.tryHide();
        }, this.minDisplaySeconds);
    }

    onDestroy(): void {
        EventManager.instance.targetOff(this);
    }

    private onAppStateChanged = (payload: AppStateChangedEventPayload): void => {
        if (payload.to !== AppState.MainMenu) return;
        this.bootCompleted = true;
        this.tryHide();
    };

    private tryHide(): void {
        if (!this.bootCompleted || !this.minTimeElapsed || !this.opacity) return;
        tween(this.opacity)
            .to(0.3, { opacity: 0 })
            .call(() => this.node.destroy())
            .start();
    }
}
