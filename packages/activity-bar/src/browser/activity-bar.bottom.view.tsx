import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Widget } from '@phosphor/widgets';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import './activity-bar.less';
import { ActivityBarService } from './activity-bar.service';

export const ActivityBarBottom = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const activityBarService: ActivityBarService = useInjectable(ActivityBarService);

  React.useEffect(() => {
    if (ref.current) {
      const tabbar = activityBarService.getTabbarWidget('bottom');
      Widget.attach(tabbar!.widget, ref.current!);
    }
  });

  return (
    <div className='bottom-bar' ref={(ele) => ref.current = ele}></div>
  );
});
