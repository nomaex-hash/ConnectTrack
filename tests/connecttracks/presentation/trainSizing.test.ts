import { expect, it, vi } from 'vitest';
vi.mock('cc', () => ({
 _decorator: { ccclass: () => (t: unknown) => t, property: () => () => {} }, Component: class {},
 Mat4: class {}, Node: class {}, ParticleSystem: class {}, UITransform: class {},
 Vec2: class { constructor(public x=0, public y=0) {} }, Vec3: class {},
}));
vi.mock('../../../assets/scripts/manager/AudioManager', () => ({ AudioManager: {} }));
import { ConnectTracksTrainView } from '../../../assets/scripts/presentation/board/connectTracksTrainView';
it('scales from the authored size for every level, including replay without accumulated scale', () => {
 const train = new ConnectTracksTrainView() as any;
 train.node = { scale: { x:.8, y:.8, z:.8, clone() { return { x:this.x,y:this.y,z:this.z }; } },
 setScale: vi.fn((x,y,z) => { train.node.scale = {x,y,z}; }) };
 train.fitToCell(50); expect(train.node.scale.x).toBeCloseTo(.4);
 train.fitToCell(50); expect(train.node.scale.x).toBeCloseTo(.4);
 train.fitToCell(150); expect(train.node.scale.x).toBeCloseTo(1.2);
 train.fitToCell(100); expect(train.node.scale.x).toBeCloseTo(.8);
 train.trainSizeMultiplier = .75; train.fitToCell(100); expect(train.node.scale.x).toBeCloseTo(.6);
});
it('scales fallback carriage spacing with cell size', () => {
 const train = new ConnectTracksTrainView() as any;
 train.cars = [null,null,null]; train.cellScaleFactor = .5;
 expect(train.buildCarOffsets()).toEqual([35,70,105]);
 train.cellScaleFactor = 1.5; expect(train.buildCarOffsets()).toEqual([105,210,315]);
});
