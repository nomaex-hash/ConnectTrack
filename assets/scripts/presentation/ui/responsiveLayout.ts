export interface FitRect { left: number; right: number; bottom: number; top: number }
export interface ResponsiveLayoutInput {
    bounds: FitRect;
    width: number; height: number; anchorX: number; anchorY: number;
    scaleX: number; scaleY: number;
    x: number; y: number;
    horizontal: number; vertical: number; // 0 unchanged, 1 lower edge, 2 center, 3 upper edge
    fitWidth: boolean; fitHeight: boolean;
    left: number; right: number; top: number; bottom: number;
}

/** Uniform shrink only. Never compound the scale from a previous layout pass. */
export function responsiveLayout(p: ResponsiveLayoutInput): { x: number; y: number; scaleX: number; scaleY: number } {
    const left = p.bounds.left + Math.max(0, p.left), right = p.bounds.right - Math.max(0, p.right);
    const bottom = p.bounds.bottom + Math.max(0, p.bottom), top = p.bounds.top - Math.max(0, p.top);
    const width = Math.abs(p.width * p.scaleX), height = Math.abs(p.height * p.scaleY);
    const ratio = Math.min(1,
        p.fitWidth && width > 0 ? Math.max(0, right - left) / width : 1,
        p.fitHeight && height > 0 ? Math.max(0, top - bottom) / height : 1);
    const sx = p.scaleX * ratio, sy = p.scaleY * ratio;
    const minX = Math.min(-p.anchorX * p.width * sx, (1 - p.anchorX) * p.width * sx);
    const maxX = Math.max(-p.anchorX * p.width * sx, (1 - p.anchorX) * p.width * sx);
    const minY = Math.min(-p.anchorY * p.height * sy, (1 - p.anchorY) * p.height * sy);
    const maxY = Math.max(-p.anchorY * p.height * sy, (1 - p.anchorY) * p.height * sy);
    const align = (mode: number, old: number, low: number, high: number, min: number, max: number): number =>
        mode === 1 ? low - min : mode === 2 ? (low + high - min - max) / 2 : mode === 3 ? high - max : old;
    return { x: align(p.horizontal, p.x, left, right, minX, maxX),
        y: align(p.vertical, p.y, bottom, top, minY, maxY), scaleX: sx, scaleY: sy };
}
