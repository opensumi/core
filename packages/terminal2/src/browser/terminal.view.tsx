import * as React from 'react';
import { observer, useObservable } from 'mobx-react-lite';
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
      console.log('terminalClient.wrapElSize', terminalClient.wrapElSize);
      // 创建第一个终端
      terminalClient.createTerminal();
      // TODO 测试创建第二个终端
      // terminalClient.createTerminal();
    }
  }, []);

  return (
    <div>
      <div className={styles.terminalWrap} style={{...terminalClient.wrapElSize}} ref={(el) => { ref.current = el; }} />
    </div>
  );
});

export const InputView = () => {
  const terminalClient: TerminalClient = useInjectable(TerminalClient);

  return (
    <div className={styles.terminalSelect}>
      <select>
        {terminalClient.termList.map((term) => {
          return (
            <option value={term[0]}>终端</option>
          );
        })}
      </select>
    </div>
  );
};
