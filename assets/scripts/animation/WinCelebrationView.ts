import { _decorator, Component, Label, Node, ParticleSystem } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('WinCelebrationView')
export class WinCelebrationView extends Component {
    @property({ type: ParticleSystem, tooltip: 'Pháo hoa bắn từ bên TRÁI màn hình (one-shot).' })
    fireworkLeft: ParticleSystem | null = null;

    @property({ type: ParticleSystem, tooltip: 'Pháo hoa bắn từ bên PHẢI màn hình (one-shot).' })
    fireworkRight: ParticleSystem | null = null;

    @property({ type: ParticleSystem, tooltip: 'Particle phụ #1 — bắn ĐỒNG THỜI với pháo hoa 2 bên (one-shot). Có thể để trống.' })
    extraParticleA: ParticleSystem | null = null;

    @property({ type: ParticleSystem, tooltip: 'Particle phụ #2 — bắn ĐỒNG THỜI với pháo hoa 2 bên (one-shot). Có thể để trống.' })
    extraParticleB: ParticleSystem | null = null;

    @property({
        type: ParticleSystem,
        tooltip: 'Pháo giấy rơi liên tục từ trên xuống khi đang hiện (particle nên đặt Loop = true).',
    })
    confettiFall: ParticleSystem | null = null;

    @property({ type: Label, tooltip: 'Label hiện text chúc mừng ngẫu nhiên.' })
    congratsLabel: Label | null = null;

    @property({
        tooltip: 'Danh sách text chúc mừng — mỗi lần play() chọn ngẫu nhiên 1 dòng. Tự chỉnh nội dung ở đây.',
    })
    congratsMessages: string[] = [];

    @property({
        tooltip: 'Trễ bao lâu (giây) rồi mới bắn 4 particle 2 bên (trái/phải + 2 particle phụ).',
    })
    sideParticleDelaySeconds = 0.3;

 
    play(): void {
        this.node.active = true;

     
        this.stopParticle(this.fireworkLeft);
        this.stopParticle(this.fireworkRight);
        this.stopParticle(this.extraParticleA);
        this.stopParticle(this.extraParticleB);

        this.unschedule(this.burstSideParticles);
        this.scheduleOnce(this.burstSideParticles, this.sideParticleDelaySeconds);
        this.startLoop(this.confettiFall);

        if (this.congratsLabel && this.congratsMessages.length > 0) {
            const index = Math.floor(Math.random() * this.congratsMessages.length);
            this.congratsLabel.string = this.congratsMessages[index];
        }
    }

    stop(): void {
        this.unschedule(this.burstSideParticles);
        this.stopParticle(this.fireworkLeft);
        this.stopParticle(this.fireworkRight);
        this.stopParticle(this.extraParticleA);
        this.stopParticle(this.extraParticleB);
        this.stopParticle(this.confettiFall);
        this.node.active = false;
    }

    private burstSideParticles = (): void => {
        this.burstOnce(this.fireworkLeft);
        this.burstOnce(this.fireworkRight);
        this.burstOnce(this.extraParticleA);
        this.burstOnce(this.extraParticleB);
    };

    private burstOnce(particle: ParticleSystem | null): void {
        if (!particle) return;
        particle.node.active = true;
        particle.stop();
        particle.clear();
        particle.play();
    }

    private startLoop(particle: ParticleSystem | null): void {
        this.burstOnce(particle);
    }

    private stopParticle(particle: ParticleSystem | null): void {
        if (!particle) return;
        particle.stop();
        particle.clear();
    }
}
