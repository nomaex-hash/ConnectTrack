import { _decorator, Component, Widget } from 'cc';

const { ccclass, property } = _decorator;

const BOTTOM_OFFSET = -25;

/**
 * Chỉnh khoảng cách đáy của thanh bottom bar qua Widget.bottom — mirror GroupButtonTabManager
 * gốc (chỉ có đúng 1 property groupAll trong Inspector, giá trị bottom hardcode trong code y
 * hệt bản gốc, không phải property). Bản gốc tách 2 giá trị mobile/non-mobile (đa nền tảng);
 * Dogdoku chỉ build cho Facebook Instant Games (luôn 1 kiểu canvas web), nên gộp về 1 giá trị.
 */
@ccclass('GroupButtonTabManager')
export class GroupButtonTabManager extends Component {
    @property(Widget)
    groupAll: Widget | null = null;

    start(): void {
        if (this.groupAll) this.groupAll.bottom = BOTTOM_OFFSET;
    }
}
