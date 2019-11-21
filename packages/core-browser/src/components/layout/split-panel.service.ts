import { Injectable, INJECTOR_TOKEN, Injector, Autowired } from '@ali/common-di';

@Injectable({ multiple: true })
export class SplitPanelService {
  constructor(public panelId: string) {}

  panels: HTMLElement[] = [];

  rootNode: HTMLElement;

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
