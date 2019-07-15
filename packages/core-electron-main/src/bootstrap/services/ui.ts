import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ElectronMainApiProvider, ElectronMainContribution, ElectronMainApiRegistry } from '../types';
import { BrowserWindow } from 'electron';
import { ElectronMainMenuService } from './menu';
import { Domain } from '@ali/ide-core-common';

@Injectable()
export class ElectronMainUIService extends ElectronMainApiProvider<'menuClick' | 'menuClose'> {

  async maximize(windowId) {
    BrowserWindow.fromId(windowId).maximize();
  }

}

@Domain(ElectronMainContribution)
export class UIElectronMainContribution implements ElectronMainContribution {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  registerMainApi(registry: ElectronMainApiRegistry) {
    registry.registerMainApi('ui', this.injector.get(ElectronMainUIService));
  }

}
