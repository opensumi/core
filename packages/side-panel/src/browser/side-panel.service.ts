import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { SidePanelHandler } from './side-panel-handler';
import { Widget } from '@phosphor/widgets';

@Injectable()
export class SidePanelService extends Disposable {
  @Autowired()
  sidePanelHandler!: SidePanelHandler;

  init(container: HTMLElement) {
    Widget.attach(this.sidePanelHandler.container, container);
  }

}
