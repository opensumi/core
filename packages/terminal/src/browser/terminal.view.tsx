import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './terminal.module.less';
import 'xterm/lib/xterm.css';
import 'xterm/lib/addons/fullscreen/fullscreen.css';
import {Terminal as XTerm} from 'xterm';
import * as attach from 'xterm/lib/addons/attach/attach';
import * as fit from 'xterm/lib/addons/fit/fit';
import * as fullscreen from 'xterm/lib/addons/fullscreen/fullscreen';
import * as search from 'xterm/lib/addons/search/search';
import * as webLinks from 'xterm/lib/addons/webLinks/webLinks';
import { useInjectable, IEventBus, ConfigContext } from '@ali/ide-core-browser';
import { TerminalService } from './terminal.service';

XTerm.applyAddon(attach);
XTerm.applyAddon(fit);
XTerm.applyAddon(fullscreen);
XTerm.applyAddon(search);
XTerm.applyAddon(webLinks);
export const Terminal = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const termService = useInjectable(TerminalService);

  React.useEffect(() => {
    const terminalContainerEl = ref.current;
    if (terminalContainerEl) {
      termService.initTerminal(terminalContainerEl);
      termService.listenResize();
    }
  }, []);

  return (
    <div className={styles.terminalWrap} ref={(el) => ref.current = el}/>
  );
});
