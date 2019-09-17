import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Widget } from '@phosphor/widgets';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import './activity-bar.less';
import { ActivityBarService } from './activity-bar.service';

export const ActivityBar = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const activityBarService: ActivityBarService = useInjectable(ActivityBarService);

  React.useEffect(() => {
    if (ref.current) {
      const tabbar = activityBarService.getTabbarWidget('left');
      Widget.attach(tabbar!.widget, ref.current!);
    }
  });

  return (
    <div className='activity-bar'>
      <div className='tab-container' ref={(ele) => ref.current = ele}></div>
      <div className='bottom-icon-container' onClick={() => activityBarService.handleSetting()}>
        <i className='activity-icon volans_icon setting'></i>
      </div>
    </div>
  );
});
