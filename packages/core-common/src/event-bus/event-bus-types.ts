import { ConstructorOf } from '../declare';
import { IDisposable } from '../disposable';
import { IAsyncResult } from '../event';

export interface IEventFireOpts {
  nextTick?: boolean;
}

export interface IAsyncEventFireOpts {
  /**
   * 异步事件发送时，listener的最大执行时长（listener并发执行)
   */
  timeout?: number;
}
export type IEventListener<T> = (target: T) => void;

export const IEventBus = Symbol('IEventBus');
export interface IEventBus {
  /**
   * 发出一个事件
   * Sample:
    class ResizeEvent extends BasicEvent<number> {}

    class LayoutStore {
      @Autowired(IEventBus)
      private eventBus: IEventBus;

      public fireResizeEvent() {
        const size = this.getSize();
        const resizeEvent = new ResizeEvent(size);
        this.eventBus.fire(resizeEvent);
      }

      // 不推荐，但是兼容 vscode 的 Event 设计
      public onDidResize(lisener: (t: ResizeEvent) => void) {
        return this.eventBus.on(ResizeEvent, lisener)
      }
    }
   */
  fire(target: any, opts?: IEventFireOpts): void;

  /**
   * 发送一个异步事件，等待并收集结果
   * @param e
   * @param opts
   */
  fireAndAwait<R>(e: any, opts?: IAsyncEventFireOpts): Promise<IAsyncResult<R>[]>;

  /**
   * 监听 EventBus 中的事件
   * Sample:
    @Injectable()
    class FileTreeStore extends WitEventBus {
      @Autowired(IEventBus)
      private eventBus: IEventBus;

      @OnEvent(LayoutResize)
      public onLayoutResize(event: LayoutResize) {
        console.log(event.payload); // size number
      }
    }
  */
  on<T>(constructor: ConstructorOf<T>, listener: IEventListener<T>): IDisposable;
  /**
   * 监听 EventBus 中的事件，只会触发一次
   */
  once<T>(constructor: ConstructorOf<T>, listener: IEventListener<T>): IDisposable;
}
