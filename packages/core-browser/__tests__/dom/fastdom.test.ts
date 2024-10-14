import { fastdom } from '@opensumi/ide-core-browser';

/**
 * 用于 mock requestAnimationFrame 的表现，可以手动触发动画帧
 */
class AnimationFrameController {
  private callbacks: Array<() => void> = [];
  private currentFrame: number = 0;
  private running: boolean = false;

  constructor() {
    this.run = this.run.bind(this);
  }

  /**
   * 触发动画帧
   */
  public run() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.callbacks.forEach((callback) => {
      callback();
    });
    this.running = false;
    this.currentFrame++;
  }

  /**
   * 注册回调函数
   * @param callback
   */

  public register(callback: () => void) {
    this.callbacks.push(callback);
  }

  /**
   * 注销回调函数
   * @param callback
   */

  public unregister(callback: () => void) {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * 获取当前的动画帧
   */
  public getCurrentFrame() {
    return this.currentFrame;
  }
}

describe('fastdom', () => {
  it('should measure', () => {
    const animationFrameController = new AnimationFrameController();

    let originalAnimationFrame = global.requestAnimationFrame;
    let originalCancelAnimationFrame = global.cancelAnimationFrame;

    global.requestAnimationFrame = (callback) => {
      animationFrameController.register(callback);
      return 1;
    };

    global.cancelAnimationFrame = () => {};
    let count = 0;
    fastdom.measure(() => {
      count++;
      expect(count).toBe(1);

      fastdom.measure(() => {
        // will run on current frame
        count++;
        expect(count).toBe(3);
      });

      fastdom.measureAtNextFrame(() => {
        // will run on next frame
        count++;
        expect(count).toBe(4);

        fastdom.measure(() => {
          count += 2;
          expect(count).toBe(6);
        });
        fastdom.mutate(() => {
          count += 3;
          expect(count).toBe(9);
        });
      });
    });

    fastdom.mutate(() => {
      count++;
      expect(count).toBe(2);
    });

    animationFrameController.run();
    animationFrameController.run();
    expect(count).toBe(9);
    animationFrameController.run();
    animationFrameController.run();
    expect(count).toBe(9);

    global.requestAnimationFrame = originalAnimationFrame;
    global.cancelAnimationFrame = originalCancelAnimationFrame;
  });
});
