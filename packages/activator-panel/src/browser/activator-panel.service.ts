import { StackedPanel } from '@phosphor/widgets';
import { Injectable } from '@ali/common-di';

@Injectable()
export class ActivatorPanelService {
  private leftStackPanel = new StackedPanel();
  private rightStackPanel = new StackedPanel();

  getPanel(side) {
    if (side === 'left') {
      return this.leftStackPanel;
    } else {
      return this.rightStackPanel;
    }
  }

  getWidgets(side) {
    if (side === 'left') {
      return this.leftStackPanel.widgets;
    } else {
      return this.rightStackPanel.widgets;
    }
  }

  insertWidget(index, widget, side) {
    if (side === 'left') {
      this.leftStackPanel.insertWidget(index, widget);
    } else {
      this.rightStackPanel.insertWidget(index, widget);
    }
  }

}
