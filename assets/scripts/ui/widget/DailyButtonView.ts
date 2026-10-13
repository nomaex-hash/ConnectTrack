import { _decorator, Component, Label, Node } from 'cc';
import { DailyServiceHolder } from '../../service/DailyServiceHolder';
import { formatDayMonth } from '../../utility/DateUtil';
import { formatElapsed } from '../../utility/TimeFormat';
import { RankBadge } from './RankBadge';

const { ccclass, property } = _decorator;


@ccclass('DailyButtonView')
export class DailyButtonView extends Component {
    @property({ type: Node, tooltip: 'Nhóm hiện khi CHƯA chơi (ngày + đếm ngược).' })
    notPlayedGroup: Node | null = null;

    @property({ type: Node, tooltip: 'Nhóm hiện khi ĐÃ chơi (ngày + thời gian + hạng).' })
    playedGroup: Node | null = null;

    @property({ type: Label, tooltip: 'Nhãn ngày DD/MM ở nhóm CHƯA chơi.' })
    dateLabelNotPlayed: Label | null = null;

    @property({ type: Label, tooltip: 'Nhãn ngày DD/MM ở nhóm ĐÃ chơi.' })
    dateLabelPlayed: Label | null = null;

    @property({ type: Label, tooltip: 'Nhãn thời gian hoàn thành ván vừa chơi (nhóm ĐÃ chơi) — KHÔNG còn hiện điểm số nữa.' })
    scoreLabel: Label | null = null;

    @property({ type: RankBadge, tooltip: 'Huy chương hạng (nhóm ĐÃ chơi).' })
    rankBadge: RankBadge | null = null;

    onEnable(): void {
        this.refresh();
    }

    refresh(): void {
        const daily = DailyServiceHolder.current;
        const dayMonth = formatDayMonth();

        if (this.dateLabelNotPlayed) this.dateLabelNotPlayed.string = dayMonth;
        if (this.dateLabelPlayed) this.dateLabelPlayed.string = dayMonth;

        const done = daily?.isDailyDoneToday() ?? false;
        if (this.notPlayedGroup) this.notPlayedGroup.active = !done;
        if (this.playedGroup) this.playedGroup.active = done;

        if (done && daily) {
            // Hiện THỜI GIAN hoàn thành (lastDailySeconds) thay vì điểm số (lastDailyScore) —
            // Daily Challenge xếp hạng theo tốc độ (xem RankService.evaluate(seconds, dogCount)),
            // điểm số không còn ý nghĩa hiển thị ở đây nữa.
            if (this.scoreLabel) this.scoreLabel.string = formatElapsed(daily.lastDailySeconds ?? 0);
            if (this.rankBadge && daily.lastDailyRank) this.rankBadge.setTier(daily.lastDailyRank);
        }
    }
}
