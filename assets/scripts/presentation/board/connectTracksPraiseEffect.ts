import { _decorator, Component, Node, ParticleSystem, Tween, UIMeshRenderer, UIOpacity, Vec3, game, isValid, tween } from 'cc';
import { StreakNumberSprite } from '../../ui/widget/StreakNumberSprite';
const { ccclass, property } = _decorator;

/** 1 phần tử gán tay cho "xN" — khớp THEO CHỈ SỐ với `tiers` (xác nhận từ user: "chỉ cần thêm
 * property gán shadow tương ứng thôi, không cần gọi cả root và tier ra") — xem
 * ConnectTracksPraiseEffect.multipliers/updateMultiplier(). "xử lý y hệt như ở màn Streak" (xác
 * nhận từ user) — dùng THẲNG component StreakNumberSprite (đã ghép nhiều chữ số + tự co giãn vừa
 * khung), CÙNG loại component mà streakValueSprite/streakValueShadowSprite dùng ở DailyStreakScreen
 * — mỗi component tự giữ bộ sprite 0-9 CỦA RIÊNG NÓ (graySprites/goldSprites, gán trong Editor),
 * KHÔNG cần mảng sprite dùng chung ở cấp ConnectTracksPraiseEffect nữa. */
@ccclass('ConnectTracksPraiseMultiplierRef')
class ConnectTracksPraiseMultiplierRef {
    @property({ type: StreakNumberSprite, tooltip: 'Số "N" CHÍNH — y hệt streakValueSprite ở màn Streak. Code tự gọi setValue(N, true).' })
    digit: StreakNumberSprite | null = null;

    @property({ type: StreakNumberSprite, tooltip: 'Số "N" BÓNG — y hệt streakValueShadowSprite ở màn Streak (xác nhận từ user: "có cả shadow của x và của số nữa"). Code tự gọi setValue(N, true) CÙNG lúc với digit.' })
    digitShadow: StreakNumberSprite | null = null;
}

/**
 * Sống TRÊN NODE GỐC của prefab hiệu ứng khen combo — tự giữ mọi cấp độ (node con) + mọi thông số
 * thời gian của chính nó. ConnectTracksBoardView chỉ lo định vị (world/local position theo ô) rồi
 * gọi play(streak, onDone), không biết gì về cấu trúc Sprite/Effect bên trong.
 *
 * "xN" khi 1 tier (thường là mức cuối, vd "Unbelievable") được đạt LẠI từ lần thứ 2 liên tiếp trở
 * lên (xác nhận từ user) — gán tay `digit`/`digitShadow` qua mảng `multipliers` (khớp CHỈ SỐ với
 * `tiers`), node gốc "Multiplier" là CON CỦA TIER (ngang hàng "Sprite"/"Effect", KHÔNG nằm trong
 * Sprite — nếu nằm trong Sprite, scale của nó sẽ nhân dồn với scale của Sprite), tự tìm qua tên —
 * hiện/biến mất CÙNG LÚC và CÙNG KIỂU hiệu ứng (pop-in/pop-out) với Sprite nhưng bằng tween RIÊNG
 * hoàn toàn độc lập (xác nhận từ user) — xem updateMultiplier()/playMultiplierPopIn()/
 * playMultiplierPopOut().
 *
 * Mỗi phần tử trong `tiers` PHẢI có đúng 1 con tên "Sprite" (hình/chữ khen) và 1 con tên "Effect"
 * (hiệu ứng rời, particle...). Hiện: Effect được BẬT TRƯỚC effectLeadSeconds giây (active=true,
 * opacity=0, particle bị stop() NGAY để chặn "Play On Awake" tự nổ — KHÔNG hiện ra bất kể material
 * particle có tuân theo UIOpacity hay không), RỒI Effect LỘ DIỆN thật sự (opacity -> 255 + particle
 * play()) VÀ Sprite bắt đầu pop-in (scale 0 -> 1, easing elasticOut) CÙNG MỘT LÚC (xác nhận từ user
 * — "effect chỉ được chạy TRƯỚC sprite chứ không được HIỆN lên trước nó, 2 node phải hiện cùng
 * nhau"). Biến mất: Sprite tự scale+opacity về 0 TRƯỚC, Effect chỉ bắt đầu mờ dần SAU khi Sprite đã
 * chạy được ~70% thời lượng biến mất của nó (xác nhận từ user) — không biến mất cùng lúc.
 *
 * "Đặt đúng liên tiếp quá nhanh thì effect chỉ nháy rồi tắt" (BUG đã sửa, xác nhận từ user) — trước
 * đây MỖI lần play() đều huỷ NGAY lập tức lần chạy trước (dù đang pop-in hay đang giữ) rồi bắt đầu
 * lại TỪ ĐẦU (scale 0), nên 2 lần gọi liên tiếp trong lúc lần TRƯỚC còn dang dở sẽ cắt ngang nó —
 * nhìn như "nháy 1 cái rồi tắt" liên tục, KHÔNG BAO GIỜ chạy trọn 1 chu kỳ. Giờ: nếu đang CÒN hiện
 * (play() gọi lại trong lúc activeTier vẫn còn, dù đang pop-in/giữ/thậm chí đang biến mất dở), chỉ
 * ĐỔI cấp độ (nếu khác) + RESET lại thời gian giữ — bỏ qua hẳn pop-in, snap thẳng full scale/opacity
 * — giống kiểu 1 bộ đếm combo tự làm mới thời gian hiện mỗi lần trúng thêm, không replay hiệu ứng
 * vào mỗi lần.
 */
@ccclass('ConnectTracksPraiseEffect')
export class ConnectTracksPraiseEffect extends Component {
    @property({
        type: [Node],
        tooltip:
            'Node theo CẤP ĐỘ tăng dần (vd Nice, Great, Awesome, Unbelievable...), gán tay ĐÚNG thứ ' +
            'tự — mỗi phần tử PHẢI có đúng 1 con tên "Sprite" và 1 con tên "Effect". play(streak) ' +
            'chọn phần tử theo chỉ số (1-based); streak vượt quá độ dài mảng thì giữ nguyên phần tử ' +
            'CUỐI (mức tối đa).',
    })
    tiers: Node[] = [];

    @property({ min: 0.01, tooltip: 'Thời gian node Sprite phóng to (scale 0 -> 1, easing elasticOut) + mờ dần hiện lên (opacity 0 -> 255) — CHỈ chạy lúc hiệu ứng BẮT ĐẦU, không replay khi combo tiếp tục.' })
    popInSeconds = 0.5;

    @property({ min: 0, tooltip: 'Thời gian giữ hiệu ứng đứng yên, tính từ lúc Sprite "đập xuống" xong (cũng là lúc Effect được bật lên) tới lúc bắt đầu biến mất — tự RESET lại mốc này mỗi lần play() được gọi lại trong lúc đang hiện (combo tiếp tục).' })
    holdSeconds = 0.6;

    @property({ min: 0.01, tooltip: 'Thời gian node Sprite biến mất (scale + opacity về 0).' })
    spriteFadeOutSeconds = 0.25;

    @property({ min: 0.01, tooltip: '(KHÔNG CÒN DÙNG) Effect nay biến mất cùng lúc và cùng thời lượng với Sprite (spriteFadeOutSeconds).' })
    effectFadeOutSeconds = 0.25;

    @property({
        min: 0,
        tooltip:
            'Effect được BẬT active=true TRƯỚC bao nhiêu giây (opacity=0, particle bị stop() ngay — ' +
            'KHÔNG hiện ra, kể cả khi material particle không tuân theo UIOpacity) trước khi NÓ và ' +
            'Sprite CÙNG LÚC thật sự lộ diện (Effect opacity -> 255 + play() particle, Sprite bắt đầu ' +
            'pop-in scale 0 -> 1 — cả 2 bắt đầu ĐỒNG THỜI). 0 = tắt (Effect play() + Sprite pop-in ' +
            'bắt đầu CÙNG lúc từ t=0, không có khoảng trễ). CHỈ áp dụng cho lần hiện ĐẦU TIÊN — combo ' +
            'tiếp tục (snap thẳng, không replay pop-in) bỏ qua giai đoạn này.',
    })
    effectLeadSeconds = 0.1;

    @property({
        min: 0,
        tooltip:
            'Khi combo tiếp tục (play() gọi lại trong lúc đang hiện), chỉ NỔ LẠI particle nếu đã qua ' +
            'ít nhất chừng này giây kể từ lần nổ trước — chống cắt ngang cú nổ đang chạy khi bấm cực ' +
            'nhanh, nhưng vẫn có nổ mới mỗi nhịp combo. 0 = nổ lại mỗi lần play().',
    })
    effectRetriggerSeconds = 0.5;

    @property({
        type: [ConnectTracksPraiseMultiplierRef],
        tooltip:
            '"xN" khi 1 tier được đạt LẠI từ lần thứ 2 liên tiếp trở lên (xác nhận từ user) — mảng ' +
            'này khớp THEO CHỈ SỐ với `tiers` phía trên (multipliers[i] ứng với tiers[i]) — phần tử ' +
            'nào KHÔNG gán `digit` thì tier đó không có "xN" (vd chỉ điền phần tử cuối cho tier ' +
            '"Unbelievable", các phần tử trước để trống). Node gốc "xN" PHẢI tên "Multiplier" — CON ' +
            'CỦA TIER (ngang hàng "Sprite"/"Effect"), KHÔNG nằm trong Sprite (code tự tìm qua tên, ' +
            'không cần gán tay) — hiện/biến mất cùng lúc + cùng kiểu hiệu ứng với Sprite bằng tween ' +
            'RIÊNG độc lập, không ăn theo transform của Sprite.',
    })
    multipliers: ConnectTracksPraiseMultiplierRef[] = [];

    /** `game.totalTime` (ms) của lần khởi động lại particle gần nhất. */
    private lastParticleRestartMs = -1e9;

    private activeTier: Node | null = null;
    private doneCallback: (() => void) | null = null;
    /** Hẹn giờ "bật Effect sớm để khởi động" TRƯỚC thời điểm lộ diện thật — xem effectLeadSeconds. */
    private effectWarmupCallback: (() => void) | null = null;
    /** Hẹn giờ "giữ xong thì bắt đầu biến mất" — tách riêng khỏi effectRevealCallback (hẹn giờ bên
     * TRONG giai đoạn biến mất) để có thể huỷ/reset độc lập mỗi lần play() refresh combo. */
    private holdTimeoutCallback: (() => void) | null = null;
    private effectRevealCallback: (() => void) | null = null;

    onLoad(): void {
        for (const tier of this.tiers) {
            tier.active = false;
            // BUG đã sửa (xác nhận từ user — "đặt nhanh từ lần Unbelievable đầu tiên sang lần tiếp
            // theo thì X bị nháy"): "Multiplier" không được ép active=false ở đây như tier — nếu nó
            // mặc định active=true sẵn trong Editor, lần ĐẦU TIÊN gọi updateMultiplier() (count=1,
            // lẽ ra ẩn) sẽ đọc root.active=true (chưa từng được code đụng tới) → tưởng "đang hiện
            // dở" → tự chạy playMultiplierPopOut() cho 1 thứ CHƯA TỪNG hiện → nháy 1 cái rồi tắt.
            const multiplier = tier.getChildByName('Multiplier');
            if (multiplier) multiplier.active = false;
        }
    }

    onDisable(): void {
        this.cancel();
    }

    onDestroy(): void {
        this.cancel();
    }

    /** Chạy hiệu ứng khen ở CẤP ĐỘ `streak` (1-based). `onDone` gọi ĐÚNG 1 LẦN khi cả Sprite lẫn
     * Effect đã biến mất hẳn — caller (board) dùng mốc này để tái sử dụng node qua NodePool. Gọi
     * play() lần nữa giữa lúc 1 lần chạy còn dang dở (activeTier vẫn còn) sẽ KHÔNG huỷ+replay —
     * xem comment đầu file. */
    play(streak: number, onDone?: () => void): void {
        if (this.tiers.length === 0) {
            this.cancel();
            onDone?.();
            return;
        }
        // BUG đã sửa (xác nhận từ user — "phải đến lần thứ 3 đạt Unbelievable mới hiện x2"): trước
        // đây đếm số lần lặp lại bằng 1 field NHỚ TRẠNG THÁI của chính component (tierRepeatCount,
        // += 1 nếu tier mới GIỐNG tier đang active) — nhưng nếu hiệu ứng lần TRƯỚC đã tắt hẳn (hết
        // holdSeconds + fade) TRƯỚC KHI mốc combo kế tiếp tới (rất dễ xảy ra — khoảng cách giữa 2
        // mốc thường xa hơn thời gian hiện+tắt của hiệu ứng), activeTier bị null hoá, bộ đếm âm thầm
        // reset về 1 dù người chơi vẫn đang đạt Unbelievable lần thứ 2/3 liên tiếp — phải "trúng"
        // đúng lúc 2 lần kề sát mới thấy tăng, nhìn như lệch 1 mốc. Giờ tính THẲNG từ `streak` (số
        // mốc combo ĐÃ đạt, không bị clamp) — không phụ thuộc component có "nhớ" được hay không.
        const rawLevel = Math.max(1, Math.floor(streak));
        const level = Math.min(rawLevel, this.tiers.length);
        const multiplierCount = rawLevel - this.tiers.length + 1;
        const tier = this.tiers[level - 1];
        const spriteNode = tier.getChildByName('Sprite');
        const effectNode = tier.getChildByName('Effect');
        if (!spriteNode) {
            this.cancel();
            tier.active = false;
            onDone?.();
            return;
        }

        const alreadyShowing = this.activeTier !== null && isValid(this.activeTier, true);
        const previousTier = this.activeTier;
        this.cancelScheduled();
        this.doneCallback = onDone ?? null;

        if (previousTier && previousTier !== tier) this.hideTierImmediate(previousTier);

        this.activeTier = tier;
        this.tiers.forEach(t => { t.active = t === tier; });

        // "Đạt Unbelievable từ 2 lần trở lên thì hiện xN" (xác nhận từ user) — xem updateMultiplier().
        this.updateMultiplier(tier, level - 1, multiplierCount);

        const spriteOpacity = spriteNode.getComponent(UIOpacity) ?? spriteNode.addComponent(UIOpacity);
        Tween.stopAllByTarget(spriteNode);
        Tween.stopAllByTarget(spriteOpacity);

        if (alreadyShowing) {
            // Combo tiếp tục giữa lúc đang hiện — snap thẳng full scale/opacity, KHÔNG replay pop-in,
            // KHÔNG qua giai đoạn khởi động effectLeadSeconds (Effect vốn đã hiện sẵn rồi).
            spriteNode.setScale(1, 1, 1);
            spriteOpacity.opacity = 255;
            this.revealEffect(effectNode, previousTier !== tier);
            this.scheduleHoldThenHide(tier, spriteNode, effectNode);
            return;
        }

        if (effectNode) effectNode.active = false;
        spriteOpacity.opacity = 0;
        spriteNode.setScale(0, 0, 1);

        const startAppear = (): void => {
            // Effect LỘ DIỆN (opacity -> 255) VÀ Sprite BẮT ĐẦU phóng to (pop-in) CÙNG MỘT LÚC tại
            // đây — effectLeadSeconds chỉ trì hoãn việc BẮT ĐẦU của cả 2, không tách rời thời điểm
            // bắt đầu của từng cái (xác nhận từ user).
            // Có warmup (lead > 0): particle đã chạy ngầm từ trước -> chỉ lộ diện, KHÔNG restart.
            this.revealEffect(effectNode, this.effectLeadSeconds <= 0);
            tween(spriteNode)
                .to(this.popInSeconds, { scale: new Vec3(1, 1, 1) }, { easing: 'elasticOut' })
                .call(() => this.scheduleHoldThenHide(tier, spriteNode, effectNode))
                .start();
            tween(spriteOpacity)
                .to(Math.min(this.popInSeconds, 0.3), { opacity: 255 })
                .start();
        };

        const leadSeconds = Math.max(this.effectLeadSeconds, 0);
        if (leadSeconds > 0) {
            // Effect chạy TRƯỚC (active=true, opacity=0 — animation/particle của nó đã khởi động
            // nhưng còn vô hình) suốt leadSeconds, RỒI MỚI tới startAppear() — xem effectLeadSeconds.
            this.warmupEffect(effectNode);
            this.effectWarmupCallback = () => {
                this.effectWarmupCallback = null;
                startAppear();
            };
            this.scheduleOnce(this.effectWarmupCallback, leadSeconds);
        } else {
            startAppear();
        }
    }

    /** Dừng ngay lập tức, ẩn hết, KHÔNG gọi onDone — dùng khi board huỷ hẳn hiệu ứng (vd onDestroy),
     * hoặc từ onDisable()/onDestroy() để dọn tween/schedule (nhất quán với mọi component khác trong
     * dự án huỷ hiệu ứng khi bị tắt/huỷ giữa chừng). KHÔNG còn gọi từ play() nữa — combo tiếp tục
     * không còn đi qua đường huỷ+replay này (xem comment đầu file). */
    cancel(): void {
        this.cancelScheduled();
        this.doneCallback = null;
        const tier = this.activeTier;
        this.activeTier = null;
        if (tier) this.hideTierImmediate(tier);
    }

    /** "xN" hiện/biến mất CÙNG LÚC và CÙNG KIỂU hiệu ứng (pop-in elasticOut / pop-out quadIn) với
     * Sprite, nhưng là 2 TWEEN TÁCH BIỆT HOÀN TOÀN (xác nhận từ user: "2 hiệu ứng phải tách biệt
     * riêng, chỉ cùng kiểu hiệu ứng hiện lên và biến mất thôi") — node gốc "Multiplier" là CON của
     * TIER (ngang hàng Sprite/Effect), KHÔNG còn nằm trong Sprite nữa (nếu còn nằm trong Sprite,
     * scale của Multiplier sẽ bị NHÂN DỒN với scale của Sprite — méo hẳn, không phải "cùng kiểu").
     * Tự so `root.active` TRƯỚC/SAU để quyết định pop-in (vừa hiện lần đầu) hay giữ nguyên (combo
     * tiếp tục, KHÔNG replay) — hoàn toàn không phụ thuộc trạng thái Sprite. Tier không có
     * "Multiplier" hoặc không gán `digit` trong multipliers[tierIndex] thì bỏ qua (không có "xN"). */
    private updateMultiplier(tier: Node, tierIndex: number, count: number): void {
        const root = tier.getChildByName('Multiplier');
        if (!root) return;
        const ref = this.multipliers[tierIndex];
        const show = count >= 2 && !!ref?.digit;
        const wasShowing = root.active;

        if (!show) {
            if (wasShowing) this.playMultiplierPopOut(root);
            return;
        }

        ref.digit?.setValue(count, true);
        ref.digitShadow?.setValue(count, true);

        if (wasShowing) {
            // BUG đã sửa (xác nhận từ user — "kích hoạt mốc cuối trong lúc xN đang biến mất thì xN
            // bị mất, phải lần sau mới hiện lại"): wasShowing=true KỂ CẢ khi root đang pop-out DỞ
            // (active vẫn true suốt lúc tween chạy, chỉ về false ở .call() cuối cùng của
            // playMultiplierPopOut()) — trước đây chỉ set active=true (vốn đã true, không làm gì)
            // mà KHÔNG huỷ tween pop-out đang chạy, nên nó cứ tiếp tục tự tắt hẳn ở cuối dù combo đã
            // tiếp tục. Phải huỷ tween dở (nếu có) + snap thẳng về hiện đầy đủ, y hệt cách Sprite tự
            // snap ở nhánh alreadyShowing.
            Tween.stopAllByTarget(root);
            const opacity = root.getComponent(UIOpacity);
            if (opacity) {
                Tween.stopAllByTarget(opacity);
                opacity.opacity = 255;
            }
            root.setScale(1, 1, 1);
            root.active = true; // chỉ cập nhật số, KHÔNG replay pop-in.
        } else {
            this.playMultiplierPopIn(root);
        }
    }

    /** Pop-in ĐỘC LẬP cho "xN" — CÙNG popInSeconds/easing elasticOut với Sprite nhưng là tween
     * RIÊNG trên CHÍNH node `root`, không ăn theo transform của bất kỳ node nào khác. */
    private playMultiplierPopIn(root: Node): void {
        const opacity = root.getComponent(UIOpacity) ?? root.addComponent(UIOpacity);
        Tween.stopAllByTarget(root);
        Tween.stopAllByTarget(opacity);
        root.active = true;
        root.setScale(0, 0, 1);
        opacity.opacity = 0;
        tween(root).to(this.popInSeconds, { scale: new Vec3(1, 1, 1) }, { easing: 'elasticOut' }).start();
        tween(opacity).to(Math.min(this.popInSeconds, 0.3), { opacity: 255 }).start();
    }

    /** Pop-out ĐỘC LẬP cho "xN" — CÙNG spriteFadeOutSeconds/easing quadIn với Sprite nhưng là tween
     * RIÊNG trên CHÍNH node `root`. */
    private playMultiplierPopOut(root: Node): void {
        const opacity = root.getComponent(UIOpacity) ?? root.addComponent(UIOpacity);
        Tween.stopAllByTarget(root);
        Tween.stopAllByTarget(opacity);
        tween(root)
            .to(this.spriteFadeOutSeconds, { scale: new Vec3(0, 0, 1) }, { easing: 'quadIn' })
            .call(() => { root.active = false; root.setScale(1, 1, 1); })
            .start();
        tween(opacity).to(this.spriteFadeOutSeconds, { opacity: 0 }).start();
    }

    /** Ẩn hẳn NGAY LẬP TỨC, không tween — dùng khi cancel()/đổi tier/finish() huỷ hẳn cả cụm. */
    private hideMultiplierImmediate(tier: Node): void {
        const root = tier.getChildByName('Multiplier');
        if (!root?.isValid) return;
        Tween.stopAllByTarget(root);
        const opacity = root.getComponent(UIOpacity);
        if (opacity) Tween.stopAllByTarget(opacity);
        root.active = false;
        root.setScale(1, 1, 1);
    }

    private cancelScheduled(): void {
        if (this.effectWarmupCallback) {
            this.unschedule(this.effectWarmupCallback);
            this.effectWarmupCallback = null;
        }
        if (this.holdTimeoutCallback) {
            this.unschedule(this.holdTimeoutCallback);
            this.holdTimeoutCallback = null;
        }
        if (this.effectRevealCallback) {
            this.unschedule(this.effectRevealCallback);
            this.effectRevealCallback = null;
        }
    }

    /** Bật Effect SỚM (active=true, opacity=0) trong lúc leadSeconds — nhưng BUG đã sửa (xác nhận từ
     * user — "effect hiện lên TRƯỚC sprite, lẽ ra chỉ được chạy trước chứ không được HIỆN trước, 2
     * node phải hiện CÙNG NHAU"): nếu Effect là ParticleSystem với "Play On Awake" bật sẵn, việc
     * active=true ở đây tự kích nổ particle NGAY LẬP TỨC — material particle (blend cộng...) nhiều
     * khi KHÔNG tuân theo UIOpacity của node cha như Sprite/Label thường, nên dù opacity=0 particle
     * vẫn hiện ra thật sự, lộ hẳn TRƯỚC sprite. Gọi stop() NGAY sau active=true để chặn đứng vụ nổ
     * "Play On Awake" đó — đảm bảo KHÔNG particle nào hiện ra trong suốt leadSeconds, bất kể
     * opacity/material. Effect chỉ thật sự "chạy" (play()) ở revealEffect(), ĐÚNG lúc Sprite cũng bắt
     * đầu pop-in — xem effectLeadSeconds. */
    private warmupEffect(effectNode: Node | null): void {
        if (!effectNode) return;
        effectNode.active = true;
        const effectOpacity = effectNode.getComponent(UIOpacity) ?? effectNode.addComponent(UIOpacity);
        Tween.stopAllByTarget(effectOpacity);
        effectOpacity.opacity = 0;
        // Particle CHẠY thật (play) nhưng KHÔNG VẼ: UIOpacity không có tác dụng lên material particle nên
        // phải tắt UIMeshRenderer của từng particle để chúng vô hình cho tới lúc revealEffect().
        this.restartParticles(effectNode);
        this.setEffectVisible(effectNode, false);
    }

    /** Lộ diện THẬT SỰ (opacity -> 255 + particle play()) — gọi đúng lúc Sprite "đập xuống" xong
     * (lần hiện ĐẦU TIÊN), VÀ mỗi lần combo tiếp tục ở CÙNG 1 tier (vd giữ nguyên "Unbelievable" —
     * mức cao nhất — nhiều lần liên tiếp, có thể cách nhau CHƯA ĐẾN 1 nhịp nổ particle nếu người
     * chơi bấm quá nhanh). BUG đã sửa (xác nhận từ user — "bấm quá nhanh thì effect chỉ nháy mà
     * không chạy"): gọi stop()/clear()/play() LẠI TỪ ĐẦU ở MỌI lần reveal (kể cả khi particle đang
     * bắn DỞ) sẽ CẮT NGANG chính nó liên tục nếu các lần trigger đến nhanh hơn 1 chu kỳ nổ — nhìn y
     * hệt "chỉ nháy rồi tắt", không bao giờ chạy trọn. Giờ: CHỈ restart nếu particle đã DỪNG hẳn
     * (`!particles.isPlaying`) — nếu đang bắn dở thì để nó CHẠY TIẾP, không cắt ngang, giữ cảm giác
     * mượt khi combo dồn dập liên tục. */
    private revealEffect(effectNode: Node | null, forceRestart = false): void {
        if (!effectNode) return;
        // KHÔNG tắt/bật lại node (active=false -> true) nữa: onEnable của ParticleSystem chỉ gọi play()
        // mà KHÔNG reset thời gian/burst, nên toggle như vậy không nổ lại được cú burst ở t=0.
        effectNode.active = true;
        const effectOpacity = effectNode.getComponent(UIOpacity) ?? effectNode.addComponent(UIOpacity);
        Tween.stopAllByTarget(effectOpacity);
        effectOpacity.opacity = 255;
        this.setEffectVisible(effectNode, true);
        const elapsed = game.totalTime - this.lastParticleRestartMs;
        if (forceRestart || elapsed >= this.effectRetriggerSeconds) this.restartParticles(effectNode);
    }

    /** CÁC ParticleSystem của Effect nằm ở NODE CON (Start1, Start2, Dot1, Dot2...), không phải trên
     * chính node "Effect" — nên PHẢI quét con cháu. BUG gốc ("bấm đúng liên tiếp quá nhanh thì effect
     * chỉ nháy rồi tắt, phải thoát ra main vào lại mới hết"): code cũ gọi getComponent(ParticleSystem)
     * trên node Effect (luôn null) nên mọi stop()/play() đều là no-op; hiệu ứng chỉ dựa vào
     * Play On Awake khi bật node. Nhưng onEnable của ParticleSystem chỉ play() mà KHÔNG reset `_time`
     * và burst — nếu lần chạy trước bị tắt giữa chừng (duration 5s, tắt sau ~1.5s) thì lần bật sau
     * tiếp tục từ thời điểm cũ, burst ở t=0 không nổ lại -> chỉ nháy/không thấy gì. stop() mới reset
     * trạng thái đó. */
    private particlesOf(effectNode: Node): ParticleSystem[] {
        return effectNode.getComponentsInChildren(ParticleSystem);
    }

    /** Bật/tắt VẼ của mọi particle trong Effect (mô phỏng vẫn chạy khi tắt vẽ). */
    private setEffectVisible(effectNode: Node, visible: boolean): void {
        for (const r of effectNode.getComponentsInChildren(UIMeshRenderer)) r.enabled = visible;
    }

    /** Reset sạch (xoá hạt + reset time/burst), KHÔNG phát — dùng lúc khởi động trước (warmup) để chặn
     * Play On Awake tự nổ khi Effect chưa được lộ diện. */
    private resetParticles(effectNode: Node): void {
        for (const ps of this.particlesOf(effectNode)) {
            ps.stop();
            ps.clear();
        }
    }

    /** Nổ lại TỪ ĐẦU: stop() (reset time/burst) + clear() rồi play(). */
    private restartParticles(effectNode: Node): void {
        this.lastParticleRestartMs = game.totalTime;
        for (const ps of this.particlesOf(effectNode)) {
            ps.stop();
            ps.clear();
            ps.play();
        }
    }

    private scheduleHoldThenHide(tier: Node, spriteNode: Node, effectNode: Node | null): void {
        this.holdTimeoutCallback = () => {
            this.holdTimeoutCallback = null;
            this.beginHide(tier, spriteNode, effectNode);
        };
        this.scheduleOnce(this.holdTimeoutCallback, this.holdSeconds);
    }

    /** Ẩn hẳn NGAY LẬP TỨC (không tween biến mất) — dùng khi cancel() hoặc khi play() đổi SANG tier
     * khác giữa lúc tier cũ còn đang hiện dở. */
    private hideTierImmediate(tier: Node): void {
        if (!isValid(tier, true)) return;
        Tween.stopAllByTarget(tier);
        const sprite = tier.getChildByName('Sprite');
        const effect = tier.getChildByName('Effect');
        if (sprite) {
            Tween.stopAllByTarget(sprite);
            const op = sprite.getComponent(UIOpacity);
            if (op) Tween.stopAllByTarget(op);
        }
        if (effect) {
            Tween.stopAllByTarget(effect);
            const op = effect.getComponent(UIOpacity);
            if (op) Tween.stopAllByTarget(op);
            this.resetParticles(effect); // reset để lần bật sau nổ lại từ đầu
            this.setEffectVisible(effect, true);
            effect.active = false;
        }
        // "Multiplier" ("xN") giờ là tween RIÊNG (xem updateMultiplier()) — phải tự dọn tween +
        // active của nó, KHÔNG còn tự ăn theo tier.active=false phía dưới nữa (không còn nằm trong
        // Sprite/tier về mặt transform-animation).
        this.hideMultiplierImmediate(tier);
        tier.active = false;
    }

    /** "Hiệu ứng tắt chưa đủ tối ưu" (xác nhận từ user) — BUG đã sửa: trước đây particle KHÔNG bị
     * stop() khi bắt đầu biến mất, chỉ fade opacity của node cha — nếu material particle không tuân
     * theo UIOpacity (xem warmupEffect()), particle tiếp tục NỔ THÊM hạt mới trong suốt lúc đang mờ
     * dần, khiến lúc tắt trông lộn xộn/không sạch. Giờ stop() NGAY lúc bắt đầu biến mất — ngừng sinh
     * hạt mới ngay, các hạt đã có tự hết tuổi thọ theo cấu hình riêng (KHÔNG clear() — xoá sạch tức
     * thì sẽ "cắt cụt" thô hơn stop() đơn thuần). */
    private beginHide(tier: Node, spriteNode: Node, effectNode: Node | null): void {
        // "xN" (nếu đang hiện) biến mất CÙNG LÚC với Sprite — tween RIÊNG, xem playMultiplierPopOut().
        const multiplierRoot = tier.getChildByName('Multiplier');
        if (multiplierRoot?.active) this.playMultiplierPopOut(multiplierRoot);
        // Ngừng PHÁT hạt mới nhưng giữ hạt đang bay (stopEmitting đánh dấu để play() sau reset sạch).
        if (effectNode) for (const ps of this.particlesOf(effectNode)) ps.stopEmitting();
        const spriteOpacity = spriteNode.getComponent(UIOpacity)!;
        tween(spriteNode)
            .to(this.spriteFadeOutSeconds, { scale: new Vec3(0, 0, 1) }, { easing: 'quadIn' })
            .start();
        tween(spriteOpacity)
            .to(this.spriteFadeOutSeconds, { opacity: 0 })
            .start();

        // Effect biến mất ĐỒNG THỜI và cùng thời lượng với Sprite (spriteFadeOutSeconds) — không trễ.
        // Hạt đang bay không tuân theo UIOpacity nên tới đúng lúc Sprite biến mất xong, finish() sẽ
        // reset + ẩn hẳn Effect cùng lúc.
        if (effectNode && isValid(effectNode, true)) {
            const effectOpacity = effectNode.getComponent(UIOpacity) ?? effectNode.addComponent(UIOpacity);
            Tween.stopAllByTarget(effectOpacity);
            effectOpacity.opacity = 255;
            tween(effectOpacity)
                .to(this.spriteFadeOutSeconds, { opacity: 0 })
                .call(() => this.finish(tier))
                .start();
        } else {
            this.effectRevealCallback = () => { this.effectRevealCallback = null; this.finish(tier); };
            this.scheduleOnce(this.effectRevealCallback, this.spriteFadeOutSeconds);
        }
    }

    private finish(tier: Node): void {
        if (this.activeTier === tier) this.activeTier = null;
        if (isValid(tier, true)) {
            const effect = tier.getChildByName('Effect');
            if (effect) { this.resetParticles(effect); this.setEffectVisible(effect, true); }
            tier.active = false;
        }
        const done = this.doneCallback;
        this.doneCallback = null;
        done?.();
    }
}
