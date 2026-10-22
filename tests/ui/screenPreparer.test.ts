import { describe, expect, it, vi } from 'vitest';
import { ScreenPreparer } from '../../assets/scripts/ui/screenPreparer';
import { AppState } from '../../assets/scripts/core/AppState';

describe('ScreenPreparer', () => {
    it('không có bộ chuẩn bị nào đăng ký thì prepare() resolve ngay', async () => {
        ScreenPreparer.set(null);
        await expect(ScreenPreparer.prepare(AppState.Gameplay)).resolves.toBeUndefined();
    });

    it('gọi bộ chuẩn bị đã đăng ký với đúng state và đợi nó xong', async () => {
        const order: string[] = [];
        const preparer = vi.fn(async (state: AppState) => {
            await Promise.resolve();
            order.push(`prepared:${state}`);
        });
        ScreenPreparer.set(preparer);
        await ScreenPreparer.prepare(AppState.Gameplay);
        order.push('after');
        expect(order).toEqual(['prepared:Gameplay', 'after']);
        ScreenPreparer.set(null);
    });

    it('lỗi khi chuẩn bị được lan ra cho caller (GameManager log "Không vào được màn chơi")', async () => {
        ScreenPreparer.set(async () => { throw new Error('bundle down'); });
        await expect(ScreenPreparer.prepare(AppState.Gameplay)).rejects.toThrow('bundle down');
        ScreenPreparer.set(null);
    });
});
