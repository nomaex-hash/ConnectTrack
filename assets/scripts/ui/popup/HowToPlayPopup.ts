import { _decorator, Label, Sprite, SpriteFrame } from 'cc';
import { UIPopup } from '../UIPopup';
import { HowToPlayIcon, HowToPlayPages } from '../../config/HowToPlayConfig';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';
import { HowToPlayCell } from '../widget/HowToPlayCell';

const { ccclass, property } = _decorator;


@ccclass('HowToPlayPopup')
export class HowToPlayPopup extends UIPopup<void> {
    @property({
        type: [HowToPlayCell],
        tooltip:
            'Các ô của bàn minh hoạ, ĐÚNG THỨ TỰ row-major (0,1 / 2,3 / 4,5). Để TRỐNG thì ' +
            'tự lấy mọi HowToPlayCell trong popup theo thứ tự cây node.',
    })
    cells: HowToPlayCell[] = [];

    /** Danh sách ô thực dùng — đã giải quyết fallback tự dò. */
    private resolvedCells: HowToPlayCell[] = [];

    @property({ type: SpriteFrame, tooltip: 'Ảnh chú chó.' })
    dogSprite: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Ảnh dấu X.' })
    markSprite: SpriteFrame | null = null;

    @property({ type: Label, tooltip: 'Dòng chữ hướng dẫn của trang hiện tại.' })
    captionLabel: Label | null = null;

    @property({
        type: [Sprite],
        tooltip: 'Dãy chấm chỉ trang (KHÔNG tương tác). Số chấm nên bằng số trang.',
    })
    dots: Sprite[] = [];

    @property({ type: SpriteFrame, tooltip: 'Ảnh chấm của trang ĐANG xem.' })
    dotActiveSprite: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Ảnh chấm của trang chưa xem.' })
    dotInactiveSprite: SpriteFrame | null = null;

    @property({ type: Label, tooltip: 'Chữ trên nút dưới cùng — đổi ở trang cuối.' })
    nextButtonLabel: Label | null = null;

    private pageIndex = 0;

    protected onShow(): void {
        // Không có bước tải nào — tắt loading NGAY (UIPopup.showLoading() tự bật lúc show()).
        this.hideLoading();
        this.resolveCells();
        this.pageIndex = 0;
        this.showPage(0);
    }

    private resolveCells(): void {
        const assigned = this.cells.filter((cell): cell is HowToPlayCell => !!cell);
        this.resolvedCells =
            assigned.length > 0 ? assigned : this.getComponentsInChildren(HowToPlayCell);
    }

    protected onHide(): void {
        this.stopAllBlink();
    }

    onTapNext(): void {
        if (this.isLastPage(this.pageIndex)) {
            this.requestClose();
            return;
        }

        this.pageIndex++;
        this.showPage(this.pageIndex);
    }

    onTapClose(): void {
        this.requestClose();
    }


    private showPage(index: number): void {
        const page = HowToPlayPages[index];
        if (!page) return;

        const previous = index > 0 ? HowToPlayPages[index - 1] : null;

        if (this.captionLabel) this.captionLabel.string = Localization.get(page.captionKey);

        for (let i = 0; i < this.resolvedCells.length; i++) {
            const icon = page.icons[i] ?? 'none';
            this.resolvedCells[i]?.setIcon(this.frameFor(icon), icon === 'mark' ? 0.7 : 0.96);
        }

        for (let i = 0; i < this.resolvedCells.length; i++) {
            const current = page.icons[i] ?? 'none';
            const before = previous ? previous.icons[i] ?? 'none' : 'none';

            if (current !== 'none' && current !== before) this.resolvedCells[i]?.setBlink(true);
        }

        this.updateDots(index);
        this.updateButton(index);
    }

    private frameFor(icon: HowToPlayIcon): SpriteFrame | null {
        if (icon === 'dog') return this.dogSprite;
        if (icon === 'mark') return this.markSprite;
        return null;
    }

    private updateDots(index: number): void {
        for (let i = 0; i < this.dots.length; i++) {
            const dot = this.dots[i];
            if (!dot) continue;

            const frame = i === index ? this.dotActiveSprite : this.dotInactiveSprite;
            if (frame) dot.spriteFrame = frame;
        }
    }

    private updateButton(index: number): void {
        if (!this.nextButtonLabel) return;
        const key = this.isLastPage(index) ? L10N.common.gotIt : L10N.common.next;
        this.nextButtonLabel.string = Localization.get(key);
    }

    private isLastPage(index: number): boolean {
        return index >= HowToPlayPages.length - 1;
    }

    private stopAllBlink(): void {
        for (const cell of this.resolvedCells) cell?.setBlink(false);
    }
}
