import { expect, it, vi } from 'vitest';
const fx = vi.hoisted(() => ({ complete: null as (() => void) | null }));
vi.mock('cc', () => ({
 _decorator: { ccclass: () => (t: unknown) => t }, Component: class {},
 Animation: class {}, ParticleSystem: class {}, UIOpacity: class { opacity = 255; },
 Sprite: class { static Type = { FILLED: 3 }; static FillType = { HORIZONTAL: 0 }; },
 isValid: (v: any) => !!v && !v.destroyed,
 Tween: { stopAllByTarget: vi.fn() },
 tween: () => { const chain = { to: () => chain, call: (cb: () => void) => { fx.complete = cb; return chain; }, start: () => chain }; return chain; },
}));
import { BootLoadingView } from '../../../assets/scripts/ui/widget/BootLoadingView';
function setup() {
 const v = new BootLoadingView() as any;
 const fill = { fillRange: 1 }, smoke = { setParent: vi.fn() }, train = {};
 const animation = { defaultClip: {}, play: vi.fn() }, particle = { play: vi.fn() };
 v.node = { getChildByPath: (p: string) => p === 'Loadingbar/load' ? { getComponent: () => fill } : train,
 getComponent: () => null, addComponent: (T: any) => new T(),
 getChildByName: (p: string) => p === 'Particle' ? smoke : { getComponentsInChildren: () => [animation] },
 getComponentsInChildren: () => [particle] };
 return { v, fill, smoke, train, animation, particle };
}
it('starts transparent and empty, keeps chimney offset and clamps actual progress', () => {
 const {v,fill,smoke,train} = setup(); v.prepare();
 expect(v.opacity.opacity).toBe(0); expect(fill.fillRange).toBe(0);
 expect(smoke.setParent).toHaveBeenCalledWith(train,true);
 v.setProgress(.4); expect(fill.fillRange).toBe(0);
 v.update(.1); expect(fill.fillRange).toBeCloseTo(.15);
 v.update(1); expect(fill.fillRange).toBe(.4);
 v.setProgress(.2); v.update(1); expect(fill.fillRange).toBe(.4);
 v.setProgress(2); v.update(1); expect(fill.fillRange).toBe(1);
});
it('waits for fade completion and starts authored animation/particles', async () => {
 const {v,animation,particle} = setup(); v.prepare();
 let ready = false; const wait = v.reveal(.4).then((ok: boolean) => { ready = ok; });
 await Promise.resolve(); expect(ready).toBe(false);
 expect(animation.play).toHaveBeenCalled(); expect(particle.play).toHaveBeenCalled();
 fx.complete!(); await wait; expect(ready).toBe(true);
});
it('cancels pending reveal when destroyed', async () => {
 const {v} = setup(); v.prepare(); const wait = v.reveal(.4); v.onDestroy();
 await expect(wait).resolves.toBe(false);
});

it('waits for the bar to reach full before completion', async () => {
 const {v,fill} = setup(); v.prepare();
 let ready = false; const wait = v.complete().then((ok: boolean) => { ready = ok; });
 v.update(.1); await Promise.resolve(); expect(ready).toBe(false);
 v.update(1); await wait; expect(ready).toBe(true); expect(fill.fillRange).toBe(1);
});

it('settles pending progress completion on destroy', async () => {
 const {v} = setup(); v.prepare(); const wait = v.complete(); v.onDestroy();
 await expect(wait).resolves.toBe(false);
});
