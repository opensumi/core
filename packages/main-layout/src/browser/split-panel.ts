import { SplitPanel } from '@phosphor/widgets';

export class TrackerSplitPanel extends SplitPanel {

  handleEvent(event: Event) {
    if (event.type === 'mousedown') {
      this.preventWebviewCatchMouseEvents();
    } else if (event.type === 'mouseup') {
      this.allowWebviewCatchMouseEvents();
    }
    super.handleEvent(event);
  }

  protected preventWebviewCatchMouseEvents() {
    const iframes = document.getElementsByTagName('iframe');
    const webviews = document.getElementsByTagName('webviews');
    for (const webview of webviews as any) {
      webview.classList.add('none-pointer-event');
    }
    for (const iframe of iframes as any) {
      iframe.classList.add('none-pointer-event');
    }
  }

  protected allowWebviewCatchMouseEvents() {
    const iframes = document.getElementsByTagName('iframe');
    const webviews = document.getElementsByTagName('webviews');
    for (const webview of webviews  as any) {
      webview.classList.remove('none-pointer-event');
    }
    for (const iframe of iframes  as any) {
      iframe.classList.remove('none-pointer-event');
    }
  }
}
