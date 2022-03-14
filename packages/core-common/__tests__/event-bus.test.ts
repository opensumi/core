import { Injectable, Injector } from '@opensumi/di';

import { EventBusImpl, BasicEvent, WithEventBus, OnEvent, IEventBus } from '../src/event-bus';

describe('event-bus', () => {
  class AEvent extends BasicEvent<number> {}
  class BEvent extends BasicEvent<string> {}

  it('event bus 能够正常执行', () => {
    const eventBus = new EventBusImpl();
    const spyA = jest.fn();
    eventBus.on(AEvent, spyA);

    const spyB = jest.fn();
    eventBus.on(BEvent, spyB);

    const aEvent = new AEvent(1);
    eventBus.fire(aEvent);
    expect(spyA).toBeCalledTimes(1);
    expect(spyA).toBeCalledWith(aEvent);

    const bEvent = new BEvent('B');
    eventBus.fire(bEvent);
    expect(spyB).toBeCalledTimes(1);
    expect(spyB).toBeCalledWith(bEvent);
  });

  it('event bus fireAndAwait能够正常执行', async (done) => {
    const eventBus = new EventBusImpl();
    const spyA = jest.fn();
    eventBus.on(AEvent, spyA);

    const validListener = async () => 'result';
    eventBus.on(AEvent, validListener);

    const error = new Error('testError');
    const errorListener = async () => {
      throw error;
    };
    eventBus.on(AEvent, errorListener);

    const aEvent = new AEvent(1);
    const res = await eventBus.fireAndAwait<AEvent, any>(aEvent);
    expect(spyA).toBeCalledTimes(1);
    expect(spyA).toBeCalledWith(aEvent);

    expect(res[1].result).toBe('result');
    expect(res[1].err).toBeUndefined();
    expect(res[2].err).toBe(error);
    expect(res[2].result).toBeUndefined;

    done();
  });

  it('event bus 能够多次触发', () => {
    const eventBus = new EventBusImpl();
    const spy = jest.fn();
    eventBus.on(AEvent, spy);
    eventBus.on(BEvent, spy);

    const a1 = new AEvent(1);
    eventBus.fire(a1);

    const a2 = new AEvent(2);
    eventBus.fire(a2);

    const b1 = new BEvent('b1');
    eventBus.fire(b1);

    expect(spy).toBeCalledTimes(3);
    expect(spy).toBeCalledWith(a1);
    expect(spy).toBeCalledWith(a2);
    expect(spy).toBeCalledWith(b1);
  });

  it('没有注册监听函数的时候，fire 不会报错', () => {
    const eventBus = new EventBusImpl();
    const a1 = new AEvent(1);
    eventBus.fire(a1);
  });

  it('使用 Decorator 去监听事件变化', () => {
    const spy = jest.fn();
    class ResizeEvent extends BasicEvent<number> {}
    const resizeEvent = new ResizeEvent(1);

    @Injectable()
    class LayoutStore extends WithEventBus {
      changeSize() {
        // do something
        this.eventBus.fire(resizeEvent);
      }
    }

    @Injectable()
    class FileTreeStore extends WithEventBus {
      @OnEvent(ResizeEvent)
      onResizeChange(event: ResizeEvent) {
        spy(event);
      }
    }

    const injector = new Injector([
      {
        token: IEventBus,
        useClass: EventBusImpl,
      },
    ]);
    const layoutStore = injector.get(LayoutStore);
    layoutStore.changeSize();
    expect(spy).toBeCalledTimes(0);

    // 获取对象实例的时候才开始注册事件
    injector.get(FileTreeStore);
    layoutStore.changeSize();
    layoutStore.changeSize();
    expect(spy).toBeCalledTimes(2);
    expect(spy).toBeCalledWith(resizeEvent);
  });

  it('event bus once 只能触发一次', () => {
    const eventBus = new EventBusImpl();
    const spy = jest.fn();
    eventBus.once(AEvent, spy);

    const a1 = new AEvent(1);
    eventBus.fire(a1);

    const a2 = new AEvent(2);
    eventBus.fire(a2);

    expect(spy).toBeCalledTimes(1);
    expect(spy).toBeCalledWith(a1);
  });
});
