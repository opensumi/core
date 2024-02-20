import { FunctionComponentElement, ReactNode } from 'react';

import { SplitPanelProps } from '@opensumi/ide-core-browser/lib/components';
import { SplitPanelService } from '@opensumi/ide-core-browser/lib/components/layout/split-panel.service';

export class DesignSplitPanelService extends SplitPanelService {
  override renderSplitPanel(
    component: JSX.Element,
    children: ReactNode[],
    props: SplitPanelProps,
  ): FunctionComponentElement<any> {
    return super.renderSplitPanel(component, children, props);
  }

  override interceptProps(props: SplitPanelProps): SplitPanelProps {
    return props;
  }
}
