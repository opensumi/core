import * as React from 'react';
import { SlotLocation, SlotRenderer } from '@ali/ide-core-browser';
import { BoxPanel, SplitPanel } from '@ali/ide-core-browser/lib/components';

import { CommonBrowserModules } from './common-modules';
import { renderApp } from './render-app';

// 引入公共样式文件
import '@ali/ide-core-browser/lib/style/index.less';
import './mock-implements/theme.less';

import { SimpleModule } from './simple-module';

// 视图和slot插槽的对应关系
const layoutConfig = {
  [SlotLocation.top]: {
    modules: ['@ali/ide-mock-top'],
  },
  [SlotLocation.action]: {
    modules: [''],
  },
  [SlotLocation.left]: {
    modules: ['@ali/ide-dw'],
  },
  [SlotLocation.right]: {
    modules: ['@ali/ide-dw-right'],
  },
  [SlotLocation.main]: {
    modules: ['@ali/ide-editor'],
  },
  [SlotLocation.statusBar]: {
    modules: ['@ali/ide-status-bar'],
  },
  [SlotLocation.extra]: {
    modules: [],
  },
};
// 插槽的划分
function LayoutComponent() {
  return <BoxPanel direction='top-to-bottom'>
    <SlotRenderer slot='top' />
    <SplitPanel overflow='hidden' id='main-horizontal' flex={1}>
      <SlotRenderer slot='left' defaultSize={310}  minResize={204} minSize={49} />
      <SlotRenderer flexGrow={1} minResize={300} slot='main' />
      <SlotRenderer slot='right' defaultSize={310} minResize={200} minSize={31} />
    </SplitPanel>
    <SlotRenderer slot='statusBar' />
  </BoxPanel>;
}

renderApp({
  modules: [ ...CommonBrowserModules, SimpleModule ],
  layoutConfig,
  layoutComponent: LayoutComponent,
  defaultPreferences: {
    'general.theme': 'ide-dark',
    'general.icon': 'vscode-icons',
    'application.confirmExit': 'never',
    'editor.quickSuggestionsDelay': 100,
    'editor.quickSuggestionsMaxCount': 50,
  },
});
