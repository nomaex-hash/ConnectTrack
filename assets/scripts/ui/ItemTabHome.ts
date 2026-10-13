import { _decorator, Button, Component, Label, Node, Sprite, SpriteFrame, Tween, UITransform, Vec3, tween } from 'cc';
import { TAB_TYPE } from '../core/TabType';

const { ccclass, property } = _decorator;

const ANIM_SECONDS = 0.15;

/**
 * 1 nút trên bottom bar Home — mirror ItemTab gốc (dự án tham khảo MagicSort), khớp đúng tên +
 * thứ tự property như Inspector thật (kể cả lỗi chính tả "UITranform" thiếu chữ "s" của bản
 * gốc — giữ nguyên cho khớp).
 *
 * KHÔNG tự tính vị trí X — Container (cha của các ItemTabHome, gồm cả vách "Vach" xen giữa)
 * gắn component Layout (Horizontal) của Cocos, tự xếp lại hàng mỗi khi bgUITranform/
 * nodeUITranform đổi bề rộng. Vì vậy bỏ hẳn property line/width/linePosX truyền từ ngoài vào —
 * mỗi ItemTabHome tự biết bề rộng chọn/không chọn của chính nó (selectedWidth/unselectedWidth).
 *
 * indexTab do HomeTabGroupManager tự gán lại = vị trí trong arrItemTabs lúc onLoad (không cần
 * tự canh tay trong Editor) — dùng để báo cho manager biết bấm trúng tab thứ mấy, thay vì phải
 * tự dò tabType.
 */
@ccclass('ItemTabHome')
export class ItemTabHome extends Component {
    @property({ type: TAB_TYPE })
    tabType: TAB_TYPE = TAB_TYPE.HOME;

    @property({ tooltip: 'Vị trí trong hàng tab (0 = trái nhất) — HomeTabGroupManager tự gán lại theo arrItemTabs lúc onLoad.' })
    indexTab = 0;

    @property(Button)
    btnTab: Button | null = null;

    @property({ type: Sprite, tooltip: 'Nền pill — chỉ hiện khi tab được chọn.' })
    bg: Sprite | null = null;

    @property({ type: UITransform, tooltip: 'UITransform của bg — co giãn theo bề rộng nút lúc chọn/bỏ chọn.' })
    bgUITranform: UITransform | null = null;

    @property({
        type: UITransform,
        tooltip: 'UITransform của CHÍNH node này — đổi width theo selectedWidth/unselectedWidth; Layout trên Container tự xếp lại hàng.',
    })
    nodeUITranform: UITransform | null = null;

    @property({ type: [SpriteFrame], tooltip: 'Ảnh nền pill lúc được chọn — index [0]. Chỉ dùng 1 phần tử, giữ dạng mảng cho khớp bản gốc.' })
    arrSfBgs: SpriteFrame[] = [];

    @property(Sprite)
    icon: Sprite | null = null;

    @property(Label)
    txtName: Label | null = null;

    @property({ tooltip: 'Bề rộng CHÍNH NÚT NÀY (px) khi được chọn — Layout trên Container tự xếp lại hàng theo giá trị này.' })
    selectedWidth = 220;

    @property({ tooltip: 'Bề rộng CHÍNH NÚT NÀY (px) khi KHÔNG được chọn.' })
    unselectedWidth = 96;

    @property({ tooltip: 'Icon dịch lên vị trí Y này khi được chọn.' })
    iconSelectedY = 68;

    @property({ tooltip: 'Icon ở vị trí Y này khi KHÔNG được chọn.' })
    iconUnselectedY = 40;

    @property({ tooltip: 'Icon scale lên bao nhiêu khi được chọn.' })
    iconSelectedScale = 1.1;

    private onTap: ((indexTab: number) => void) | null = null;
    private iconTween: Tween<Node> | null = null;
    private labelTween: Tween<Node> | null = null;

    /** HomeTabGroupManager gọi 1 lần lúc khởi tạo để nhận callback đổi tab (báo indexTab, không phải tabType). */
    setOnTap(onTap: (indexTab: number) => void): void {
        this.onTap = onTap;
    }

    /** HomeTabGroupManager gọi cho MỌI tab mỗi khi đổi tab — tự đổi icon/label/nền + bề rộng. */
    showTab(isSelected: boolean): void {
        this.iconTween?.stop();
        this.labelTween?.stop();

        const width = isSelected ? this.selectedWidth : this.unselectedWidth;
        if (this.bg) this.bg.spriteFrame = isSelected ? this.arrSfBgs[0] ?? null : null;
        if (this.bgUITranform) this.bgUITranform.width = width;
        if (this.nodeUITranform) this.nodeUITranform.width = width;

        if (isSelected) {
            if (this.txtName) {
                this.txtName.node.active = true;
                this.txtName.node.setScale(0, 0, 1);
                this.labelTween = tween(this.txtName.node)
                    .to(ANIM_SECONDS, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
                    .start();
            }
            if (this.icon) {
                this.iconTween = tween(this.icon.node)
                    .to(
                        ANIM_SECONDS,
                        {
                            scale: new Vec3(this.iconSelectedScale, this.iconSelectedScale, 1),
                            position: new Vec3(0, this.iconSelectedY, 0),
                        },
                        { easing: 'quadOut' },
                    )
                    .start();
            }
        } else {
            if (this.txtName) this.txtName.node.active = false;
            if (this.icon) {
                this.iconTween = tween(this.icon.node)
                    .to(ANIM_SECONDS, { scale: new Vec3(1, 1, 1), position: new Vec3(0, this.iconUnselectedY, 0) }, { easing: 'quadOut' })
                    .start();
            }
        }
    }

    /** Gắn clickEvents của btnTab trỏ vào đây. */
    onTouchTab(): void {
        this.onTap?.(this.indexTab);
    }
}
