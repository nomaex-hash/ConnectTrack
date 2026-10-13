import { _decorator, Component, Sprite, Vec2, Vec4 } from 'cc';

const { ccclass, property } = _decorator;


@ccclass('UVScrollBackground')
export class UVScrollBackground extends Component {
    @property({
        tooltip: 'Hướng cuộn UV. (-1,-1) = chéo từ phải xuống trái.',
    })
    direction: Vec2 = new Vec2(-1, -1);

    @property({
        tooltip: 'Tốc độ cuộn theo đơn vị UV/giây (1 = trôi hết một lần lặp texture mỗi giây). Ví dụ 0.05.',
    })
    speed = 0.05;

    @property({
        tooltip:
            'Số lần lặp texture trên mặt nền (x, y). Ảnh hoa văn nhỏ thì tăng lên để giữ ' +
            'kích thước hoa văn tự nhiên; ảnh đã phủ kín thì để (1, 1).',
    })
    tiling: Vec2 = new Vec2(1, 1);

    private sprite: Sprite | null = null;
    private readonly dir = new Vec2();
    private offsetX = 0;
    private offsetY = 0;
    private readonly scroll = new Vec4(0, 0, 1, 1);

    onLoad(): void {
        this.sprite = this.getComponent(Sprite);
        if (!this.sprite) {
            console.error('[UVScrollBackground] Node phải có cc.Sprite.');
            return;
        }

        const len = this.direction.length();
        if (len < 1e-4) this.dir.set(-0.7071, -0.7071);
        else this.dir.set(this.direction.x / len, this.direction.y / len);
    }

    update(dt: number): void {
        if (!this.sprite) return;

  
        this.offsetX = fract(this.offsetX + this.dir.x * this.speed * dt);
        this.offsetY = fract(this.offsetY + this.dir.y * this.speed * dt);

        this.scroll.set(this.offsetX, this.offsetY, this.tiling.x, this.tiling.y);

        const material = this.sprite.getMaterialInstance(0);
        material?.setProperty('scroll', this.scroll);
    }
}

function fract(value: number): number {
    return value - Math.floor(value);
}
