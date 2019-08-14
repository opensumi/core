import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Title, Widget } from '@phosphor/widgets';
import { ActivityBarWidget } from './activity-bar-widget.view';
import { AppConfig, ConfigProvider, SlotRenderer } from '@ali/ide-core-browser';
import { View, ViewsContainerWidget } from '@ali/ide-activity-panel/lib/browser/views-container-widget';

export class ActivityBarHandler {
  widget: ViewsContainerWidget = this.title.owner as ViewsContainerWidget;

  constructor(private title: Title<Widget>, private activityBar: ActivityBarWidget, private configContext: AppConfig) {
  }

  dispose() {
    this.activityBar.tabBar.removeTab(this.title);
  }

  activate() {
    this.activityBar.currentWidget = this.widget;
  }

  setComponent(Fc: React.FunctionComponent | React.FunctionComponent[]) {
    ReactDOM.render(
      <ConfigProvider value={this.configContext} >
        <SlotRenderer Component={Fc} />
      </ConfigProvider>
    , this.widget.node);
  }

  setSize(size: number) {
    this.activityBar.showPanel(size);
  }

  setBadge(badge: string) {
    // @ts-ignore
    this.title.badge = badge;
    this.activityBar.tabBar.update();
  }

  registerView(view: View, component?: React.FunctionComponent) {
    this.widget.addWidget(view, view.component || component!);
  }
}
