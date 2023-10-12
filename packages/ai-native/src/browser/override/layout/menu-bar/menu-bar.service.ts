import { Injectable, Autowired } from '@opensumi/di';

@Injectable()
export class AiMenubarService {
  private latestWidth = 0;

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
        chatPanel.style.width = this.latestWidth + 'px';
      }

      this.latestWidth = preWidth;
    }
  }
}
