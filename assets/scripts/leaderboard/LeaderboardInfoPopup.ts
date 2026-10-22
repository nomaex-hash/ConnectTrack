// @ts-nocheck

import { _decorator, Button, Node, ParticleSystem, Tween, UIOpacity, Vec3, tween } from 'cc';
import { BasePopup } from '../common/BasePopup';
import { Constants } from '../framework/constants';
const { ccclass, property } = _decorator;

@ccclass('LeaderboardInfoPopup')
export class LeaderboardInfoPopup extends BasePopup {
    @property(Node) title: Node = null;
    @property(Node) cluster1: Node = null;

    @property(Node) text1: Node = null;
    @property(Node) arrow1: Node = null;

    @property({ type: Node, tooltip: 'Trái tim Ở GIỮA — hiện đầu tiên trong cụm 2.' })
    heartMid: Node = null;

    @property({ type: Node, tooltip: 'Hiệu ứng glow — hiện ĐỒNG THỜI với heartMid.' })
    glow2: Node = null;

    @property({ type: Node, tooltip: 'Ngôi sao — hiện ĐỒNG THỜI với heartMid.' })
    star2: Node = null;

    @property({ type: Node, tooltip: 'Trái tim THỨ 2 — bắt đầu hiện khi tim giữa đạt heart2StartFraction, LUÔN kết thúc cùng lúc tim giữa.' })
    heart2: Node = null;

    @property({ type: Node, tooltip: 'Trái tim CUỐI — hiện SAU khi 2 tim đầu đã xong.' })
    heart3: Node = null;

    @property({ type: Node, tooltip: 'Mũi tên 2 — bắt đầu hiện khi tim cuối đạt arrow2TriggerFraction.' })
    arrow2: Node = null;

    @property(Node) cluster3: Node = null;
    @property(Node) text3: Node = null;
    @property(Node) arrow3: Node = null;

    @property(Node) cluster4: Node = null;
    @property({ type: Node, tooltip: 'Hiệu ứng glow — hiện ĐỒNG THỜI với cluster4.' })
    glow4: Node = null;
    @property({ type: Node, tooltip: 'Ngôi sao — hiện ĐỒNG THỜI với cluster4.' })
    star4: Node = null;
    @property(Node) text4: Node = null;
    @property({ type: Node, tooltip: 'Nút "Tap to Continue" — bấm để đóng popup.' })
    btnContinue: Node = null;

    @property({ tooltip: 'Thời gian hiện (giây) cho các bước đơn giản: cụm 1/3/4, text+mũi tên, text4+continue.' })
    revealDuration = 0.4;

    @property({ tooltip: 'Scale bắt đầu (trước khi phình to về 1).' })
    fromScale = 0.5;

    @property({ tooltip: 'Tên easing (theo Cocos Tween) cho MỌI hiệu ứng hiện — ví dụ backOut, quadOut.' })
    easing = 'backOut';

    @property({ tooltip: 'Thời gian hiện trái tim GIỮA (giây).' })
    heartMidDuration = 0.5;

    @property({ tooltip: 'Trái tim thứ 2 bắt đầu hiện khi tim GIỮA đã hiện tới tỉ lệ này (0-1) trên tổng heartMidDuration.' })
    heart2StartFraction = 0.5;

    @property({ tooltip: 'Thời gian hiện trái tim CUỐI (giây).' })
    heartLastDuration = 0.5;

    @property({ tooltip: 'Mũi tên 2 bắt đầu hiện khi tim CUỐI đã hiện tới tỉ lệ này (0-1) trên tổng heartLastDuration.' })
    arrow2TriggerFraction = 0.5;

    @property({ tooltip: 'Kiểu hiện "nối nhau": node SAU bắt đầu hiện khi node TRƯỚC đã hiện tới tỉ lệ này (0-1) — áp dụng cho text1->arrow1->cụm2, cụm3->arrow3->cụm4.' })
    chainTriggerFraction = 0.8;

    protected onEnable(): void {
        super.onEnable();
        this.btnContinue?.on(Constants.CLICK, this.onTouchContinue, this);
    }

    protected onDisable(): void {
        super.onDisable();
        this.btnContinue?.off(Constants.CLICK, this.onTouchContinue, this);
        this.unscheduleAllCallbacks();
    }

    private introFinished = false;

    private onTouchContinue(): void {
        if (!this.introFinished) return;
        this.hidePopup();
    }

  
    private originalScale: Map<Node, Vec3> = new Map();

    onLoad(): void {
        super.onLoad();
        for (const node of this.allAnimatableNodes()) {
            if (node && !this.originalScale.has(node)) {
                this.originalScale.set(node, node.getScale().clone());
            }
        }
    }

    private allAnimatableNodes(): Node[] {
        return [this.title, this.cluster1].concat(this.allNodes());
    }

    private targetScaleFor(node: Node): Vec3 {
        return this.originalScale.get(node) ?? new Vec3(1, 1, 1);
    }


    private startScaleFor(node: Node): Vec3 {
        const target = this.targetScaleFor(node);
        const sign = (v: number) => (v < 0 ? -1 : 1);
        return new Vec3(
            sign(target.x) * this.fromScale,
            sign(target.y) * this.fromScale,
            target.z || 1,
        );
    }


    showPopup(cbWhenClose: Function = null): void {
        this.resetAll();
        super.showPopup(cbWhenClose);
    }

    showPoup_ShowView_Finished(): void {
        super.showPoup_ShowView_Finished();
        this.playIntroSequence();
    }


    private allNodes(): Node[] {
        return [
            this.text1, this.arrow1,
            this.heartMid, this.glow2, this.star2, this.heart2, this.heart3, this.arrow2,
            this.cluster3, this.text3, this.arrow3,
            this.cluster4, this.glow4, this.star4, this.text4, this.btnContinue,
        ];
    }


    private resetAll(): void {
        for (const node of this.allNodes()) {
            if (!node) continue;
            Tween.stopAllByTarget(node);
            const opacity = node.getComponent(UIOpacity);
            if (opacity) {
                Tween.stopAllByTarget(opacity);
                opacity.opacity = 0;
            }
            node.setScale(this.startScaleFor(node));
            node.active = false;
        }
        this.forceShowStep1();
    }


    private forceShowStep1(): void {
        for (const node of [this.title, this.cluster1]) {
            if (!node) continue;
            Tween.stopAllByTarget(node);
            const opacity = node.getComponent(UIOpacity);
            if (opacity) {
                Tween.stopAllByTarget(opacity);
                opacity.opacity = 255;
            }
            node.setScale(this.targetScaleFor(node));
            node.active = true;
        }
    }

  
    private playIntroSequence(): void {
        this.unscheduleAllCallbacks();
        this.introFinished = false;
        this.resetAll();

        this.revealNode(this.text1, this.revealDuration, 0, () => {});

        const arrow1Delay = this.revealDuration * this.chainTriggerFraction;
        this.revealNode(this.arrow1, this.revealDuration, arrow1Delay, () => {});

        const heartsDelay = arrow1Delay + this.revealDuration * this.chainTriggerFraction;
        this.scheduleOnce(() => this.playHeartsThenRest(), heartsDelay);
    }

    private playHeartsThenRest(): void {
        const heart2Delay = this.heartMidDuration * this.heart2StartFraction;
        const heart2Duration = Math.max(0, this.heartMidDuration - heart2Delay);

        let midDone = false;
        let heart2Done = false;
        const onFirstTwoDone = () => {
            if (!midDone || !heart2Done) return;

            this.revealNode(this.heart3, this.heartLastDuration, 0, () => {});

            const arrow2Delay = this.heartLastDuration * this.arrow2TriggerFraction;
            this.revealNode(this.arrow2, this.revealDuration, arrow2Delay, () => {});
            const cluster3Delay = arrow2Delay + this.revealDuration * this.chainTriggerFraction;
            this.scheduleOnce(() => this.playCluster3ThenRest(), cluster3Delay);
        };

        this.revealNode(this.heartMid, this.heartMidDuration, 0, () => {
            midDone = true;
            onFirstTwoDone();
        });

        this.revealNode(this.glow2, this.heartMidDuration, 0, () => {});
        this.revealNode(this.star2, this.heartMidDuration, 0, () => {});

        this.revealNode(this.heart2, heart2Duration, heart2Delay, () => {
            heart2Done = true;
            onFirstTwoDone();
        });
    }

    /** Cụm 3 hiện trước; khi đạt chainTriggerFraction thì mũi tên 3 (+ text3, hiện đồng thời với
     * mũi tên 3) hiện theo; khi mũi tên 3 đạt chainTriggerFraction thì cụm 4 (+glow4+star4) bắt
     * đầu. text4 + nút Tap to Continue vẫn CHỜ cụm 4 hiện XONG HẲN (không nối kiểu 80%, vì đây là
     * bước cuối, không có mũi tên nào theo sau). */
    private playCluster3ThenRest(): void {
        this.revealNode(this.cluster3, this.revealDuration, 0, () => {});

        const arrow3Delay = this.revealDuration * this.chainTriggerFraction;
        this.revealNode(this.arrow3, this.revealDuration, arrow3Delay, () => {});
        this.revealNode(this.text3, this.revealDuration, arrow3Delay, () => {});

        const cluster4Delay = arrow3Delay + this.revealDuration * this.chainTriggerFraction;
        this.scheduleOnce(() => {
            this.revealGroup([this.cluster4, this.glow4, this.star4], () => {
                this.revealGroup([this.text4, this.btnContinue], () => {
                    this.introFinished = true;
                });
            });
        }, cluster4Delay);
    }

    private revealGroup(nodes: Node[], onDone: () => void): void {
        const valid = nodes.filter((n) => !!n);
        if (valid.length === 0) {
            onDone();
            return;
        }
        let remaining = valid.length;
        for (const node of valid) {
            this.revealNode(node, this.revealDuration, 0, () => {
                remaining--;
                if (remaining <= 0) onDone();
            });
        }
    }

  
    private revealNode(node: Node | null, duration: number, delay: number, onDone: () => void): void {
        if (!node) {
            onDone();
            return;
        }

        const run = () => {
            if (!node.isValid) {
                onDone();
                return;
            }
            Tween.stopAllByTarget(node);
            node.active = true;
            node.setScale(this.startScaleFor(node));

       
            const particle = node.getComponent(ParticleSystem);
            if (particle) {
                particle.clear();
                particle.play();
            }

            const opacity = node.getComponent(UIOpacity);
            tween(node).to(duration, { scale: this.targetScaleFor(node) }, { easing: this.easing }).start();
            if (opacity) {
                Tween.stopAllByTarget(opacity);
                opacity.opacity = 0;
                tween(opacity).to(duration, { opacity: 255 }, { easing: this.easing, onComplete: onDone }).start();
            } else {
                this.scheduleOnce(onDone, duration);
            }
        };

        if (delay > 0) this.scheduleOnce(run, delay);
        else run();
    }
}
