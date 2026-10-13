import { APPEAR_DURATION } from './CellView';

/** Mỗi ô kế tiếp theo đường chéo (row+col) trễ hơn ô trước bao lâu (giây). */
export const APPEAR_STAGGER = 0.03;

/**
 * Tổng thời gian để TOÀN BỘ bàn cờ n×n hiện xong (ô xa nhất theo đường chéo bắt đầu
 * trễ nhất, rồi mất thêm APPEAR_DURATION để hiện xong). Dùng chung cho BoardView
 * (tự nó) và mọi UI khác cần biết CHÍNH XÁC lúc bàn cờ hiện xong (RuleFrameIntro...).
 */
export function boardAppearDuration(size: number): number {
    return (size - 1) * 2 * APPEAR_STAGGER + APPEAR_DURATION;
}
