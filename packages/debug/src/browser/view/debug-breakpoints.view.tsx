import * as React from 'react';
import { DebugBreakpointsService } from './debug-breakpoints.service';
import { useInjectable } from '@ali/ide-core-browser';
import * as styles from './debug-breakpoints.module.less';
import * as cls from 'classnames';
import { CheckBox, CheckBoxSize } from '@ali/ide-core-browser/lib/components/input';
import { observer } from 'mobx-react-lite';
import { DebugBreakpoint } from '../model';

export interface BreakpointItem {
  name: string;
  id: string;
  description: string;
  breakpoint: DebugBreakpoint;
}

export const DebugBreakpointView = observer(() => {
  const {
    nodes,
    enable,
  }: DebugBreakpointsService = useInjectable(DebugBreakpointsService);
  return <div className={cls(styles.debug_breakpoints, !enable && styles.debug_breakpoints_disabled)}>
    {
      nodes && nodes.map((node) => {
        return <BreakpointItem data={node} key={node.id} enable={enable}></BreakpointItem>;
      })
    }

  </div>;
});

export const BreakpointItem = ({
  data,
  enable,
}: {
  data: BreakpointItem,
  enable: boolean,
}) => {
  const [value] = React.useState<boolean>(true);
  const onChange = () => {
    data.breakpoint.remove();
  };
  return <div className={styles.debug_breakpoints_item}>
    <div className={cls(enable ? 'kaitian-debug-breakpoint' : 'kaitian-debug-breakpoint-disabled', styles.debug_breakpoints_icon)}></div>
    <CheckBox size={CheckBoxSize.SMALL} id={data.id} label={data.name} defaultChecked={value} onChange={onChange}></CheckBox>
    <div className={styles.debug_breakpoints_description}>{data.description}</div>
  </div>;
};
