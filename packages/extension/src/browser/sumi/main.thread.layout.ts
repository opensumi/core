import { Injectable, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { IEventBus, Disposable, ILogger } from '@opensumi/ide-core-browser';
import { IMainLayoutService, TabBarRegistrationEvent } from '@opensumi/ide-main-layout';
import { TabBarHandler } from '@opensumi/ide-main-layout/lib/browser/tabbar-handler';
import { IconType, IconShape, IIconService } from '@opensumi/ide-theme';

import { ExtHostSumiAPIIdentifier } from '../../common/sumi';
import { IMainThreadLayout, IExtHostLayout } from '../../common/sumi/layout';

@Injectable({ multiple: true })
export class MainThreadLayout extends Disposable implements IMainThreadLayout {
  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  @Autowired(IIconService)
  private iconService: IIconService;

  handlerMap = new Map<string, TabBarHandler>();

  proxy: IExtHostLayout;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(ILogger)
  logger: ILogger;

  constructor(rpcProtocol: IRPCProtocol) {
    super();
    this.proxy = rpcProtocol.getProxy(ExtHostSumiAPIIdentifier.ExtHostLayout);
  }

  $setTitle(id: string, title: string): void {
    this.getHandler(id).updateTitle(title);
  }

  $setIcon(id: string, iconPath: string): void {
    const iconClass = this.iconService.fromIcon('', iconPath, IconType.Background, IconShape.Square);
    this.getHandler(id).setIconClass(iconClass!);
  }

  $setSize(id: string, size: number): void {
    this.getHandler(id).setSize(size);
  }

  $activate(id: string): void {
    this.getHandler(id).activate();
  }

  $deactivate(id: string): void {
    this.getHandler(id).deactivate();
  }

  $setBadge(id: string, badge: string): void {
    this.getHandler(id).setBadge(badge);
  }

  async $setVisible(id: string, visible: boolean) {
    if (visible) {
      this.getHandler(id).show();
    } else {
      if (this.getHandler(id).isActivated()) {
        this.getHandler(id).deactivate();
      }
      this.getHandler(id).hide();
    }
  }

  async $connectTabbar(id: string) {
    if (!this.handlerMap.has(id)) {
      const handle = this.layoutService.getTabbarHandler(id);
      if (handle) {
        this.bindHandleEvents(handle);
      } else {
        const disposer = this.eventBus.on(TabBarRegistrationEvent, (e) => {
          if (e.payload.tabBarId === id) {
            const handle = this.layoutService.getTabbarHandler(id);
            this.bindHandleEvents(handle!);
            disposer.dispose();
          }
        });
        this.addDispose(disposer);
      }
    }
  }

  // 视图可能未注册到layout上，此时调用该方法返回false
  async $isAttached(id: string) {
    return !!this.layoutService.getTabbarHandler(id);
  }

  private bindHandleEvents(handle: TabBarHandler) {
    this.handlerMap.set(handle.containerId, handle);
    handle.onActivate(() => {
      this.proxy.$acceptMessage(handle.containerId, 'activate');
    });
    handle.onInActivate(() => {
      this.proxy.$acceptMessage(handle.containerId, 'deactivate');
    });
  }

  protected getHandler(id: string) {
    const handler = this.layoutService.getTabbarHandler(id);
    if (!handler) {
      this.logger.warn(`MainThreaLayout:没有找到${id}对应的handler`);
    }
    return handler!;
  }
}
