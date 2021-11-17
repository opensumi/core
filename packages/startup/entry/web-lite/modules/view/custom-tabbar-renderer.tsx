import React from 'react';
import { ComponentRegistryInfo, useInjectable } from '@ide-framework/ide-core-browser';
import { TabRendererBase, TabbarConfig } from '@ide-framework/ide-main-layout/lib/browser/tabbar/renderer.view';
import { TabbarViewBase, IconElipses } from '@ide-framework/ide-main-layout/lib/browser/tabbar/bar.view';
import { RightTabPanelRenderer } from '@ide-framework/ide-main-layout/lib/browser/tabbar/panel.view';
import { TabbarService, TabbarServiceFactory } from '@ide-framework/ide-main-layout/lib/browser/tabbar/tabbar.service';
import cls from 'classnames';
import './styles.less';

export const RightTabRenderer = ({className, components}: {className?: string, components: ComponentRegistryInfo[]}) => (
  <TabRendererBase side='right' direction='right-to-left' className={cls('right-slot', className)} components={components} TabbarView={RightTabbarRenderer} TabpanelView={RightTabPanelRenderer} />
);

const RightTabbarRenderer: React.FC = () => {
  const { side } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  return (<div className='right_tab_bar' onContextMenu={tabbarService.handleContextMenu}>
    <TabbarViewBase
      tabSize={44}
      MoreTabView={IconElipses}
      tabClassName='kt_right_tab'
      TabView={TextTabView}
      barSize={30}
      panelBorderSize={1}/>
  </div>);
};

const TextTabView: React.FC<{
  component: ComponentRegistryInfo;
}> = ({component}) => {
  return <div className='dw-rotate'>{component.options?.title}</div>;
};
