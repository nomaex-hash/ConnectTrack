import { PuzzleData } from '../model/PuzzleData';
import { PuzzleContext } from '../model/BoardSaveData';


export interface IPuzzleProvider {

    load(context: PuzzleContext, id: number): Promise<PuzzleData>;

    /** Tải trước 1 puzzle CHƯA CẦN DÙNG NGAY (vd màn kế tiếp, trong lúc popup Result đang
     * hiện) — để khi load() đúng puzzle đó thì trả về ngay, không phải đợi round-trip
     * resources.load() nữa. */
    preload(context: PuzzleContext, id: number): void;

    /** Bỏ 1 preload chưa được load() dùng tới (vd người chơi rời Gameplay theo hướng KHÁC
     * với preload đó) — tránh rò rỉ asset còn giữ tham chiếu mãi. */
    cancelPreload(): void;

    release(context: PuzzleContext, id: number): void;
}
