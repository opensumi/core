import { Injectable, Injector, Autowired } from '@ali/common-di';
import { IElectronMainLifeCycleService } from '@ali/ide-core-common/lib/electron';
import { IRPCProtocol } from '@ali/ide-connection';
import { IMainThreadLayout, IExtHostLayout } from '../../common/kaitian/layout';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { TabBarHandler } from '@ali/ide-main-layout/lib/browser/tabbar-handler';
import { ExtHostKaitianAPIIdentifier } from '../../common/kaitian';

@Injectable({ multiple: true })
export class MainThreaLayout implements IMainThreadLayout {
  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  handlerMap = new Map<string, TabBarHandler>();

  proxy: IExtHostLayout;

  constructor(private rpcProtocol: IRPCProtocol, private injector: Injector) {
    this.proxy = rpcProtocol.getProxy(ExtHostKaitianAPIIdentifier.ExtHostLayout);
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

  async $connectTabbar(id: string) {
    if (!this.handlerMap.has(id)) {
      const handle = this.layoutService.getTabbarHandler(id);
      if (handle) {
        this.handlerMap.set(id, handle);
        handle.onActivate(() => {
          this.proxy.$acceptMessage(id, 'activate');
        });
        handle.onInActivate(() => {
          this.proxy.$acceptMessage(id, 'deactivate');
        });
      }
    }
  }

  protected getHandler(id: string) {
    const handler = this.layoutService.getTabbarHandler(id);
    if (!handler) {
      console.warn(`MainThreaLayout:没有找到${id}对应的handler`);
    }
    return handler;
  }

}
