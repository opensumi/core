import { localize } from '@ali/ide-core-browser';
import { MaybePromise, DisposableCollection, IDisposable, Disposable, ILogger } from '@ali/ide-core-common';
import { QuickOpenModel, QuickOpenOptions, QuickOpenService, QuickOpenItem, PrefixQuickOpenService } from './quick-open.model';
import { Injectable, Autowired } from '@ali/common-di';

export const QuickOpenContribution = Symbol('QuickOpenContribution');

export interface QuickOpenContribution {
  registerQuickOpenHandlers(handlers: QuickOpenHandlerRegistry): void;
}

export interface QuickOpenHandler {
  /** 是否是默认的面板处理函数 */
  default?: boolean;
  /**
   * 命令面板中的处理函数
   */
  prefix: string;
  /**
   * 在帮助面板中显示的描述
   */
  description: string;
  /**
   * 初始化函数，一般做展示数据的收集
   */
  init?(): MaybePromise<void>;
  /**
   * 获取 QuickOpenModel，用于提供 Items
   */
  getModel(): QuickOpenModel;
  /**
   * 获取面板的参数，用于额外设置 QuickOpen
   */
  getOptions(): QuickOpenOptions;
}

@Injectable()
export class QuickOpenHandlerRegistry implements IDisposable {
  protected readonly handlers: Map<string, QuickOpenHandler> = new Map();
  protected readonly toDispose = new DisposableCollection();
  protected defaultHandler: QuickOpenHandler | undefined;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  registerHandler(handler: QuickOpenHandler): IDisposable {
    if (this.handlers.has(handler.prefix)) {
      this.logger.warn(`前缀是 ${handler.prefix} 的处理函数已经存在`);
      return Disposable.NULL;
    }
    this.handlers.set(handler.prefix, handler);
    const disposable = {
      dispose: () => this.handlers.delete(handler.prefix),
    };
    this.toDispose.push(disposable);

    if (handler.default) {
      this.defaultHandler = handler;
    }
    return disposable;
  }

  getDefaultHandler(): QuickOpenHandler | undefined {
    return this.defaultHandler;
  }

  isDefaultHandler(handler: QuickOpenHandler): boolean {
    return handler === this.getDefaultHandler();
  }

  getHandlers(): QuickOpenHandler[] {
    return [...this.handlers.values()];
  }

  /**
   * Return a handler that matches the given text or the default handler if none.
   */
  getHandlerOrDefault(text: string): QuickOpenHandler | undefined {
    for (const handler of this.handlers.values()) {
      if (text.startsWith(handler.prefix)) {
        return handler;
      }
    }
    return this.getDefaultHandler();
  }

  dispose(): void {
    this.toDispose.dispose();
  }
}

@Injectable()
export class PrefixQuickOpenServiceImpl implements PrefixQuickOpenService {

  @Autowired(QuickOpenHandlerRegistry)
  protected readonly handlers: QuickOpenHandlerRegistry;

  @Autowired(QuickOpenService)
  protected readonly quickOpenService: QuickOpenService;

  open(prefix: string): void {
    const handler = this.handlers.getHandlerOrDefault(prefix);
    this.setCurrentHandler(prefix, handler);
  }

  protected toDisposeCurrent = new DisposableCollection();
  protected currentHandler: QuickOpenHandler | undefined;

  protected async setCurrentHandler(prefix: string, handler: QuickOpenHandler | undefined): Promise<void> {
    if (handler !== this.currentHandler) {
      this.toDisposeCurrent.dispose();
      this.currentHandler = handler;
      this.toDisposeCurrent.push(Disposable.create(() => {
        const closingHandler = handler && handler.getOptions().onClose;
        if (closingHandler) {
          closingHandler(true);
        }
      }));
    }
    if (!handler) {
      this.doOpen();
      return;
    }
    if (handler.init) {
      await handler.init();
    }
    let optionsPrefix = prefix;
    if (this.handlers.isDefaultHandler(handler) && prefix.startsWith(handler.prefix)) {
      optionsPrefix = prefix.substr(handler.prefix.length);
    }
    const skipPrefix = this.handlers.isDefaultHandler(handler) ? 0 : handler.prefix.length;
    const handlerOptions = handler.getOptions();
    this.doOpen({
      prefix: optionsPrefix,
      skipPrefix,
      ...handlerOptions,
    });
  }

  protected doOpen(options?: QuickOpenOptions): void {
    const handler = this.currentHandler;
    const curModel = handler && handler.getModel() || {
      getItems: (lookFor) => [new QuickOpenItem({
        label: localize('quickopen.command.nohandler'),
      })],
    };
    this.quickOpenService.open({
      getItems: (lookFor) => {
        const handler = this.handlers.getHandlerOrDefault(lookFor);
        // 如果不是当前处理函数，则设置最新的处理函数
        if (handler !== this.currentHandler) {
          this.setCurrentHandler(lookFor, handler);
        }
        // 搜索时需要删除默认的前缀
        const searchValue = (!handler || this.handlers.isDefaultHandler(handler)) ? lookFor : lookFor.substr(handler.prefix.length);

        return curModel.getItems(searchValue);
      },
    }, options);
  }
}
