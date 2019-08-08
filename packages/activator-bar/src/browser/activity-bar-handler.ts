import { Title, Widget } from '@phosphor/widgets';
import { ActivatorBarWidget } from './activator-bar-widget.view';

export class ActivityBarHandler {
  constructor(private title: Title<Widget>, private activityBar: ActivatorBarWidget) {}

  dispose() {
    this.activityBar.tabBar.removeTab(this.title);
  }

  activate() {
    this.activityBar.currentWidget = this.title.owner;
  }

}
