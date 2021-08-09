import { Injectable, INJECTOR_TOKEN, Injector, Autowired } from '@ali/common-di';

// TODO min_size挂到单个panel下
const MIN_SIZE = 120;

@Injectable({ multiple: true })
export class SplitPanelService {
  constructor(public panelId: string) {}

  panels: HTMLElement[] = [];

  rootNode: HTMLElement | undefined;

  get isVisible(): boolean {
    return this.rootNode && this.rootNode.clientHeight > 0 || false;
  }

  getFirstResizablePanel(index: number, direction: boolean, isPrev?: boolean): HTMLElement | undefined {
    if (isPrev) {
      if (direction) {
        return this.panels[index];
      } else {
        for (let i = index; i >= 0; i--) {
          if (this.panels[i].clientHeight > MIN_SIZE) {
            return this.panels[i];
          }
        }
      }
    } else {
      if (!direction) {
        return this.panels[index + 1];
      } else {
        for (let i = index + 1; i < this.panels.length; i++) {
          if (this.panels[i].clientHeight > MIN_SIZE) {
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
