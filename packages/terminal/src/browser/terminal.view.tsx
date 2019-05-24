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

XTerm.applyAddon(attach);
XTerm.applyAddon(fit);
XTerm.applyAddon(fullscreen);
XTerm.applyAddon(search);
XTerm.applyAddon(webLinks);
export const Terminal = observer(() => {

  const ref = React.useRef<HTMLElement | null>();

  let cols = -1;
  let rows = -1;
  const connectSocket = null;
  const connectDataSocket = null;

  React.useEffect(() => {
    const terminalContainerEl = ref.current;
    if (terminalContainerEl) {

      while (terminalContainerEl.children.length) {
        terminalContainerEl.removeChild(terminalContainerEl.children[0]);
      }
      const term = new XTerm({
        macOptionIsMeta: false,
        cursorBlink: false,
        scrollback: 2500,
        tabStopWidth: 8,
        fontSize: 12,
      });

      term.open(terminalContainerEl);
      // term.winptyCompatInit();
      // term.webLinksInit();
      // term.fit();

      cols = term.cols;
      rows = term.rows;
    }
  });

  return (
    <div className={styles.terminalWrap} ref={(el) => ref.current = el}/>
  );
});
