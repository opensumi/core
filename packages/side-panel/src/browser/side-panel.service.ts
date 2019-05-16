import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { SidePanelHandler } from './side-panel-handler';
import { Widget } from '@phosphor/widgets';
import {Message} from '@phosphor/messaging';

class ContentWidget extends Widget {

  static createNode(name: string): HTMLElement {
    const node = document.createElement('div');
    const content = document.createElement('div');
    const input = document.createElement('input');
    input.placeholder = 'Placeholder...' + name;
    content.appendChild(input);
    node.appendChild(content);
    return node;
  }

  constructor(name: string) {
    super({ node: ContentWidget.createNode(name) });
    this.setFlag(Widget.Flag.DisallowLayout);
    this.addClass('content');
    this.addClass(name.toLowerCase());
    this.title.label = name;
    this.title.closable = true;
    this.title.caption = `Long description for: ${name}`;
  }

  get inputNode(): HTMLInputElement {
    return this.node.getElementsByTagName('input')[0] as HTMLInputElement;
  }

  protected onActivateRequest(msg: Message): void {
    if (this.isAttached) {
      this.inputNode.focus();
    }
  }
}

@Injectable()
export class SidePanelService extends Disposable {
  @Autowired()
  sidePanelHandler!: SidePanelHandler;

  init(container: HTMLElement) {
    this.sidePanelHandler.create();
    this.sidePanelHandler.addTab(new ContentWidget('test').title);
    this.sidePanelHandler.addTab(new ContentWidget('hhhh').title);
    Widget.attach(this.sidePanelHandler.container, container);
  }
}
