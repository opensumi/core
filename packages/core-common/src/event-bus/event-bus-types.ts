import { IDisposable } from '../disposable';
import { ConstructorOf } from '../declare';

export interface IEventFireOpts {
  nextTick?: boolean;
}

export interface IEventLisnter<T> {
  (target: T): void;
}

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
  on<T>(constructor: ConstructorOf<T>, listener: IEventLisnter<T>): IDisposable;
}
