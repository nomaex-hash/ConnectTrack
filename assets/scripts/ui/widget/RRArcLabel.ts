import { _decorator, Component, instantiate, Label, Node, UITransform } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Text bent on an arc (the warped ribbon title of the original): one Label per character, copied from an
 * inactive template, placed along a circle whose centre is `radius` below the node (arch shape).
 */
@ccclass('RRArcLabel')
export class RRArcLabel extends Component {
    @property({ type: Label, tooltip: 'Inactive label giving the font, size, colour and outline' })
    template: Label = null;
    @property({ tooltip: 'Radius of the arc (bigger = flatter)' })
    radius = 900;
    @property({ tooltip: 'Extra space between characters' })
    spacing = 0;
    @property
    private _string = '';

    @property
    get string(): string {
        return this._string;
    }

    set string(v: string) {
        this._string = v;
        this.build();
    }

    private chars: Node[] = [];

    onLoad() {
        if (this._string) this.build();
    }

    private build() {
        if (!this.template) return;
        for (const n of this.chars) n.destroy();
        this.chars = [];
        const widths: number[] = [];
        for (const c of this._string) {
            const n = instantiate(this.template.node);
            n.active = true;
            n.setParent(this.node);
            const label = n.getComponent(Label)!;
            label.string = c;
            label.updateRenderData(true);
            widths.push(n.getComponent(UITransform)!.width + this.spacing);
            this.chars.push(n);
        }
        const total = widths.reduce((a, b) => a + b, 0);
        let x = -total / 2;
        this.chars.forEach((n, i) => {
            const mid = x + widths[i] / 2;
            const a = mid / this.radius;
            n.setPosition(Math.sin(a) * this.radius, Math.cos(a) * this.radius - this.radius, 0);
            n.angle = (-a * 180) / Math.PI;
            x += widths[i];
        });
    }
}
