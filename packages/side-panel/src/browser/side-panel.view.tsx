import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { SidePanelService } from './side-panel.service';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import * as styles from './index.module.less';

export const SidePanel = observer(() => {
  const ref = React.useRef<HTMLElement | null>();
  const instance = useInjectable(SidePanelService);
  const layout = instance.layout;
  const containerStyle = {width: `${layout.width}px`, height: `${layout.height}px`}  as React.CSSProperties;

  React.useEffect(() => {
    if (ref.current) {
      instance.initialize(ref.current as HTMLElement);
    }
  }, [ref]);

  return (
    <div style={containerStyle} className={styles.side_panel_container} ref={(el) => ref.current = el} />
  );
});
