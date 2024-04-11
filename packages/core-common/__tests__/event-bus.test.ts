import { Injectable, Injector } from '@opensumi/di';

import { BasicEvent, EventBusImpl, IEventBus, OnEvent, WithEventBus } from '../src/event-bus';

describe('event-bus', () => {
  class AEvent extends BasicEvent<number> {}
  class BEvent extends BasicEvent<string> {}

  it('event bus work', () => {
    const eventBus = new EventBusImpl();
    const spyA = jest.fn();
    eventBus.on(AEvent, spyA);

    const spyB = jest.fn();
    eventBus.on(BEvent, spyB);

    const aEvent = new AEvent(1);
    eventBus.fire(aEvent);
    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyA).toHaveBeenCalledWith(aEvent);

    const bEvent = new BEvent('B');
    eventBus.fire(bEvent);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledWith(bEvent);
  });

  it('event bus fireAndAwait should be work', async () => {
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
    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyA).toHaveBeenCalledWith(aEvent);

    expect(res[1].result).toBe('result');
    expect(res[1].err).toBeUndefined();
    expect(res[2].err).toBe(error);
    expect(res[2].result).toBeUndefined;
  });

  it('event bus can be triggered multiple times', () => {
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

    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledWith(a1);
    expect(spy).toHaveBeenCalledWith(a2);
    expect(spy).toHaveBeenCalledWith(b1);
  });

  it('fire will not report an error when no listener function is registered', () => {
    const eventBus = new EventBusImpl();
    const a1 = new AEvent(1);
    eventBus.fire(a1);
  });

  it('use Decorator to listen for event changes', () => {
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
    expect(spy).toHaveBeenCalledTimes(0);

    // 获取对象实例的时候才开始注册事件
    injector.get(FileTreeStore);
    layoutStore.changeSize();
    layoutStore.changeSize();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(resizeEvent);
  });

  it('event bus once can only be triggered once', () => {
    const eventBus = new EventBusImpl();
    const spy = jest.fn();
    eventBus.once(AEvent, spy);

    const a1 = new AEvent(1);
    eventBus.fire(a1);

    const a2 = new AEvent(2);
    eventBus.fire(a2);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(a1);
  });
});
