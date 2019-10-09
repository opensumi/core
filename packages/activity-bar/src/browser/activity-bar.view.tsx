import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Widget } from '@phosphor/widgets';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import './activity-bar.less';
import { ActivityBarService } from './activity-bar.service';
import { getIcon } from '@ali/ide-core-browser/lib/icon';

export const ActivityBar = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const {
    handleSetting,
    getTabbarWidget,
  }: ActivityBarService = useInjectable(ActivityBarService);

  React.useEffect(() => {
    if (ref.current) {
      const tabbar = getTabbarWidget('left');
      Widget.attach(tabbar!.widget, ref.current!);
    }
  });

  return (
    <div className='activity-bar'>
      <div className='tab-container' ref={(ele) => ref.current = ele}></div>
      <div className='bottom-icon-container' onClick={handleSetting}>
        <i className={`activity-icon ${getIcon('setting')}`}></i>
      </div>
    </div>
  );
});
