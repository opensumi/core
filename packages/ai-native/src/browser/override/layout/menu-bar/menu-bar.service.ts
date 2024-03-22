import { Injectable, Autowired } from '@opensumi/di';
import { BasicEvent, Dispatcher, Disposable } from '@opensumi/ide-core-common';

import { AI_CHAT_DEFAULT_SIZE } from '../../../../common';

@Injectable()
export class AiMenubarService extends Disposable {
  private latestWidth = 0;
  public onDidChangeDispatcher: Dispatcher<number, 'latestWidth'> = this.registerDispose(new Dispatcher());

  public getLatestWidth(): number {
    return this.latestWidth;
  }

  /**
   * 这里先这样处理，暂时没找到原因
   */
  public toggleRightPanel() {
    const domID = 'div[id*=ai_chat_panel___]';
    const chatPanel = document.querySelector(domID)?.parentElement?.parentElement;

    if (chatPanel) {
      let preWidth: number | string = chatPanel.style.width;
      preWidth = parseInt(preWidth, 10);

      if (preWidth !== 0) {
        chatPanel.style.width = '0px';
      } else {
        chatPanel.style.width = `${this.latestWidth || AI_CHAT_DEFAULT_SIZE}px`;
      }

      this.latestWidth = preWidth;
      this.onDidChangeDispatcher.dispatch('latestWidth', preWidth);
    }
  }
}
