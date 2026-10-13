import { _decorator, Component, Vec2, Vec3 } from 'cc';

const { ccclass, property } = _decorator;


@ccclass('ScrollingBackground')
export class ScrollingBackground extends Component {
    @property({
        tooltip: 'Hướng cuộn. (-1,-1) = chéo từ phải xuống trái (nội dung trôi sang trái + xuống).',
    })
    direction: Vec2 = new Vec2(-1, -1);

    @property({ tooltip: 'Tốc độ cuộn (px/giây).' })
    speed = 40;

    @property({
        tooltip:
            'Chu kỳ lặp của texture (px) — WRAP theo số này. Đặt = kích thước MỘT ô lặp của ' +
            'ảnh nền. Sai số này thì lúc wrap sẽ thấy nền "giật".',
    })
    tileSize = 256;

    private readonly base = new Vec3();
    private readonly dir = new Vec2();
    private offsetX = 0;
    private offsetY = 0;

    onLoad(): void {
        this.node.getPosition(this.base);

        const len = this.direction.length();
        if (len < 1e-4) {
            this.dir.set(-0.7071, -0.7071);
        } else {
            this.dir.set(this.direction.x / len, this.direction.y / len);
        }
    }

    update(dt: number): void {
        if (this.tileSize <= 0) return;

        this.offsetX = (this.offsetX + this.dir.x * this.speed * dt) % this.tileSize;
        this.offsetY = (this.offsetY + this.dir.y * this.speed * dt) % this.tileSize;

        this.node.setPosition(
            this.base.x + this.offsetX,
            this.base.y + this.offsetY,
            this.base.z,
        );
    }
}
