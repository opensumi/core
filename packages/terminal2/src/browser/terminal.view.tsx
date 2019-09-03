import * as React from 'react';
import {observer} from 'mobx-react-lite';
import * as styles from './terminal.module.less';
import 'xterm/lib/xterm.css';
import 'xterm/lib/addons/fullscreen/fullscreen.css';
import { useInjectable } from '@ali/ide-core-browser';
import { TerminalClient } from './terminal.client';

export const TerminalView = observer(() => {
  const ref = React.useRef<HTMLElement | null>();
  const ref1 = React.useRef<HTMLElement | null>();
  const terminalClient = useInjectable(TerminalClient);

  React.useEffect(() => {
    const terminalContainerEl = ref.current;
    const terminalContainerEl1 = ref1.current;
    if (terminalContainerEl) {
      terminalClient.createTerminal(terminalContainerEl);
    }
    if (terminalContainerEl1) {
      terminalClient.createTerminal(terminalContainerEl1);
    }
  }, []);

  return (
    <div>
      <div className={styles.terminalWrap} ref={(el) => { ref.current = el; }} />
      <div className={styles.terminalWrap} ref={(el) => { ref1.current = el; }} />
    </div>
  );
});
