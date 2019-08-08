import { StackedPanel } from '@phosphor/widgets';
import { Injectable } from '@ali/common-di';

@Injectable()
export class ActivatorPanelService {
  private leftStackPanel = new StackedPanel();
  private rightStackPanel = new StackedPanel();

  getPanel(side) {
    switch (side) {
      case 'right':
        return this.rightStackPanel;
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
