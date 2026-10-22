// @ts-nocheck
import { _decorator, Component, Label, Node } from 'cc';
import { FBInstantCommon_Callback } from './FBInstantManager';
const { ccclass, property } = _decorator;

/** Định dạng CỐ ĐỊNH "00:00:00" (luôn đủ 2 chữ số cho giờ/phút/giây, kể cả giờ=0) — dùng chung
 * cho mọi nơi gắn CountDownTimeEvent (TournamentResetPopup, tab Weekly, LeaderboardPreviewPopup,
 * Starter Pack...). Trước đây dùng Utils.getTimeStrByS_HaveDay_Event (đổi format tuỳ mốc ngày/giờ:
 * "Xd HHh" / "Hh Mm" / "MM:SS") — không còn phù hợp từ khi giải đấu Weekly chỉ còn tối đa 1 ngày. */
function formatFixedClock(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

@ccclass('CountDownTimeEvent')
export class CountDownTimeEvent extends Component {
    @property(Label)
    txtCountDownTime: Label;

    @property(Label)
    txtCountDownTime_Shadow: Label;

    countTime: number = 0;

    cb: Function = null;

    initTime(_time: number) {
        this.countTime = _time;
        if(this.txtCountDownTime_Shadow){
            this.txtCountDownTime_Shadow.string = formatFixedClock(this.countTime);
        }
        this.txtCountDownTime.string = formatFixedClock(this.countTime);
    }

    initCountDownTime(_time: number, _callback: FBInstantCommon_Callback) {
        this.cb = _callback;
        this.countTime = _time;
        if(this.txtCountDownTime_Shadow){
            this.txtCountDownTime_Shadow.string = formatFixedClock(this.countTime);
        }
        this.txtCountDownTime.string = formatFixedClock(this.countTime);
        this.unschedule(this.showTime);
        this.schedule(this.showTime, 1);
        this.node.active = true;
    }

    onEnable() {
        // Cocos tự unschedule() mọi callback của Component khi node/component bị disable (xem
        // onDisable() bên dưới) nhưng KHÔNG tự lên lịch lại khi enable trở lại — nếu node này nằm
        // trong một cụm bị ẩn tạm thời (ví dụ hideUntilLoaded của LeaderboardTabGroupManager lúc
        // đang tải dữ liệu) rồi hiện lại, đồng hồ sẽ đứng yên mãi mãi vì showTime() không bao giờ
        // được gọi tiếp. Chỉ resume nếu đã initCountDownTime() ít nhất 1 lần (có cb) và chưa chạm 0.
        if (this.cb && this.countTime > 0) {
            this.unschedule(this.showTime);
            this.schedule(this.showTime, 1);
        }
    }

    onDisable() {
        this.unschedule(this.showTime);
    }

    showTime() {
        this.countTime--;
        if (this.countTime > 0) {
            if (this.txtCountDownTime_Shadow) {
                this.txtCountDownTime_Shadow.string = formatFixedClock(this.countTime);
            }
            this.txtCountDownTime.string = formatFixedClock(this.countTime);
        } else {
            this.countTime = 0;
            if (this.txtCountDownTime_Shadow) {
                this.txtCountDownTime_Shadow.string = formatFixedClock(this.countTime);
            }
            this.txtCountDownTime.string = formatFixedClock(this.countTime);
            this.unschedule(this.showTime);

            this.cb!();
        }
    }
}
