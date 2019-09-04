import * as React from 'react';
import {observer} from 'mobx-react-lite';
import * as styles from './terminal.module.less';
import 'xterm/lib/xterm.css';
import 'xterm/lib/addons/fullscreen/fullscreen.css';
import { useInjectable } from '@ali/ide-core-browser';
import { TerminalClient } from './terminal.client';

export const TerminalView = observer(() => {
  const ref = React.useRef<HTMLElement | null>();
  const terminalClient: TerminalClient = useInjectable(TerminalClient);

  React.useEffect(() => {
    const terminalContainerEl = ref.current;
    if (terminalContainerEl) {
      terminalClient.setWrapEl(terminalContainerEl);
      // 创建第一个终端
      terminalClient.createTerminal();
    }
  }, []);

  return (
    <div>
      <div className={styles.terminalWrap} ref={(el) => { ref.current = el; }} />
    </div>
  );
});
