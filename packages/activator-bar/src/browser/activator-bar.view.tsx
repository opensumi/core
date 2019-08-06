import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Widget } from '@phosphor/widgets';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import './activator-bar.less';
import { ActivatorBarService } from './activator-bar.service';

export const ActivatorBar = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const activatorBarService: ActivatorBarService = useInjectable(ActivatorBarService);

  React.useEffect(() => {
    if (ref.current) {
      const tabbar = activatorBarService.getTabbarWidget('left');
      Widget.attach(tabbar!, ref.current!);
    }
  });

  return (
    <div className='activator-bar' ref={(ele) => ref.current = ele}></div>
  );
});
