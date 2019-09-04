import { StackedPanel } from '@phosphor/widgets';
import { Injectable } from '@ali/common-di';

@Injectable()
export class ActivityPanelService {
  private leftStackPanel = new StackedPanel();
  private rightStackPanel = new StackedPanel();
  private bottomStackPanel = this.createBottomPanel();

  private createBottomPanel() {
    const panel = new StackedPanel();
    panel.addClass('bottom-stack-panel');
    panel.addClass('overflow-visible');
    panel.fit();
    return panel;
  }

  getPanel(side) {
    switch (side) {
      case 'right':
        return this.rightStackPanel;
      case 'bottom':
        return this.bottomStackPanel;
      default:
        return this.leftStackPanel;
    }
  }

  getWidgets(side) {
    return this.getPanel(side).widgets;
  }

  insertWidget(index, widget, side) {
    this.getPanel(side).insertWidget(index, widget);
  }

}
