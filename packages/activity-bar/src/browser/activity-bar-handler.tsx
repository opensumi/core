import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Title, Widget } from '@phosphor/widgets';
import { ActivityBarWidget } from './activity-bar-widget.view';
import { AppConfig, ConfigProvider, SlotRenderer } from '@ali/ide-core-browser';

export class ActivityBarHandler {
  constructor(private title: Title<Widget>, private activityBar: ActivityBarWidget, private configContext: AppConfig) {}

  dispose() {
    this.activityBar.tabBar.removeTab(this.title);
  }

  activate() {
    this.activityBar.currentWidget = this.title.owner;
  }

  setComponent(Fc: React.FunctionComponent) {
    ReactDOM.render(
      <ConfigProvider value={this.configContext} >
        <SlotRenderer Component={Fc} />
      </ConfigProvider>
    , this.title.owner.node);
  }

  setSize(size: number) {
    this.activityBar.showPanel(size);
  }
}
