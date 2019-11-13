import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from '@ali/ide-core-browser/lib/components/layout/layout';
import { ComponentRegistryInfo, useInjectable } from '@ali/ide-core-browser';
import { TabbarService, TabbarServiceManager } from './tabbar.service';
import { observer } from 'mobx-react-lite';

export const BaseTabPanelView: React.FC<{
  side: string;
  components: ComponentRegistryInfo[];
  PanelView: React.FC<{component: ComponentRegistryInfo}>;
}> = observer(({components, PanelView, side}) => {
  const serviceManager = useInjectable<TabbarServiceManager>(TabbarServiceManager);
  const tabbarService: TabbarService = serviceManager.getService(side);
  const { currentContainerId } = tabbarService;
  const panelVisible = {zIndex: 1, display: 'block'};
  const panelInVisible = {zIndex: -1, display: 'none'};
  return (
    <div className='tab-panel'>
      {components.map((component) => {
        return <div className={clsx( styles.panel_wrap )} style={currentContainerId === component.options!.containerId ? panelVisible : panelInVisible}>
          <PanelView component={component} />
        </div>;
      })}
    </div>
  );
});

const RightPanelView: React.FC<{
  component: ComponentRegistryInfo;
}> = (({ component }) => {
  const ViewComponent = component.views[0].component!;
  return (
    <div className={clsx( styles.right_panel )}>
      <ViewComponent />
    </div>
  );
});

export const RightTabPanelRenderer: React.FC<{
  components: ComponentRegistryInfo[];
  side: string;
}> = ({components, side}) => <BaseTabPanelView side={side} components={components} PanelView={RightPanelView} />;
