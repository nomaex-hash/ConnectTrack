import { _decorator, Component, Node, Tween, UIOpacity, Vec3, tween } from 'cc';

const { ccclass, property } = _decorator;

/** Xuất công khai để LeaderboardGroupWeek/World trễ đúng bằng lúc trang mờ→đậm xong mới hiện từng dòng. */
export const SLIDE_IN_SECONDS = 0.35;

/**
 * Base animation kéo-vào-từ-cạnh + mờ→đậm dần — CHỈ dùng cho tab con NHỎ (Tuần/Thế giới bên
 * trong Leaderboard, xem LeaderboardGroupWeek/World). KHÁC với BaseTabGroupManager (carousel
 * trượt cả hàng Shop/Home/Leaderboard, xem HomeTabGroupManager) — 2 cấp tab có UX khác hẳn
 * nhau: cấp ngoài đẩy cả khối theo kiểu carousel, cấp trong chỉ cần trang mới tự bay vào đè
 * lên (trang Tuần/Thế giới không "đẩy" nhau).
 */
@ccclass('SlideFadeTabPage')
export abstract class SlideFadeTabPage extends Component {
    @property({ tooltip: 'Kéo trang vào từ cách vị trí nghỉ bao nhiêu px (âm = từ trái, dương = từ phải).' })
    slideFromOffsetX = -720;

    private activeTween: Tween<Node> | null = null;
    private restPositionX: number | null = null;

    /** Trang được chọn — kéo từ cạnh vào + mờ→đậm dần. */
    showGroup(): void {
        this.activeTween?.stop();
        this.node.active = true;

        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);

        if (this.restPositionX === null) this.restPositionX = this.node.position.x;
        const restX = this.restPositionX;

        this.node.setPosition(restX + this.slideFromOffsetX, this.node.position.y, this.node.position.z);
        opacity.opacity = 0;

        this.activeTween = tween(this.node)
            .to(
                SLIDE_IN_SECONDS,
                { position: new Vec3(restX, this.node.position.y, this.node.position.z) },
                { easing: 'quadOut' },
            )
            .start();
        tween(opacity).to(SLIDE_IN_SECONDS, { opacity: 255 }, { easing: 'linear' }).start();
    }

    /** Trang bị rời khỏi — tắt NGAY, không animation. */
    setHide(): void {
        this.activeTween?.stop();
        this.node.active = false;
    }
}
