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
        theme: {
          foreground: '#657b83',
          background: '#fdf6e3',
          cursor: '#657b83',
          cursorAccent: '#657b83',
          selection: '#eee8d566',
          'red': '#dc322f',
          'green': '#859900',
          'yellow': '#b58900',
          'blue': '#268bd2',
          'magenta': '#d33682',
          'cyan': '#2aa198',
          'black': '#073642',
          'white': '#b58900',
          'brightBlack': '#b58900',
          'brightRed': '#cb4b16',
          'brightGreen': '#586e75',
          'brightYellow': '#657b83',
          'brightBlue': '#839496',
          'brightMagenta': '#6c71c4',
          'brightCyan': '#93a1a1',
          'brightWhite': '#b58900',
        },
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
