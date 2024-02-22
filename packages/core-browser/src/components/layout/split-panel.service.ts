import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Deferred } from '@opensumi/ide-core-common';

@Injectable({ multiple: true })
export class SplitPanelService {
  private static MIN_SIZE = 120;
  constructor(public panelId: string) {}

  private _whenReadyDeferred: Deferred<void> = new Deferred();

  panels: HTMLElement[] = [];

  rootNode: HTMLElement | undefined;

  get isVisible(): boolean {
    return (this.rootNode && this.rootNode.clientHeight > 0) || false;
  }

  get whenReady() {
    return this._whenReadyDeferred.promise;
  }

  setRootNode(node: HTMLElement) {
    this.rootNode = node;
    this._whenReadyDeferred.resolve();
  }

  getFirstResizablePanel(index: number, direction: boolean, isPrev?: boolean): HTMLElement | undefined {
    if (isPrev) {
      if (direction) {
        return this.panels[index];
      } else {
        for (let i = index; i >= 0; i--) {
          if (this.panels[i].clientHeight > SplitPanelService.MIN_SIZE) {
            return this.panels[i];
          }
        }
      }
    } else {
      if (!direction) {
        return this.panels[index + 1];
      } else {
        for (let i = index + 1; i < this.panels.length; i++) {
          if (this.panels[i].clientHeight > SplitPanelService.MIN_SIZE) {
            return this.panels[i];
          }
        }
      }
    }
  }
}

@Injectable()
export class SplitPanelManager {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  services: Map<string, SplitPanelService> = new Map();

  getService(panelId: string) {
    let service = this.services.get(panelId);
    if (!service) {
      service = this.injector.get(SplitPanelService, [panelId]);
      this.services.set(panelId, service);
    }
    return service;
  }
}
