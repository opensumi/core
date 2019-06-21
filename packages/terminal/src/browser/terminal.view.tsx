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
import { useInjectable, IEventBus, AppConfig, getSlotLocation, ConfigContext } from '@ali/ide-core-browser';
import { ResizeEvent } from '@ali/ide-main-layout/lib/browser/ide-widget.view';

const pkgName = require('../../package.json').name;

XTerm.applyAddon(attach);
XTerm.applyAddon(fit);
XTerm.applyAddon(fullscreen);
XTerm.applyAddon(search);
XTerm.applyAddon(webLinks);
export const Terminal = observer(() => {

  const ref = React.useRef<HTMLElement | null>();
  const cols = React.useRef<number>();
  const rows = React.useRef<number>();
  const connectSocket = React.useRef<any>();
  const connectDataSocket =  React.useRef<any>();
  const term =  React.useRef<any>();
  const eventBus = useInjectable(IEventBus);
  const config: AppConfig  = useInjectable(AppConfig);
  const configContext = React.useContext(ConfigContext);

  const connectRemote = () => {
    // TODO: 根据窗口进行划分
    const recordId = 1;
    connectSocket.current = new WebSocket(`${config.wsPath}/terminal/connect/${recordId}`);
    connectSocket.current.addEventListener('open', (e) => {
      connectSocket.current.send(JSON.stringify({
        action: 'create',
        payload: {
          cols: cols.current,
          rows: rows.current,
          cwd: config.workspaceDir,
        },
      }));
    });
    connectSocket.current.addEventListener('message', (e) => {
      let msg = e.data;
      try {
        msg = JSON.parse(msg);
      } catch (err) {
        console.log(err);
      }

      if (msg.action === 'create') {
        connectDataSocket.current = new WebSocket(`${config.wsPath}/terminal/data/connect/${recordId}`);

        connectDataSocket.current.addEventListener('open', () => {
          term.current.attach(connectDataSocket.current);
        }, false);
        connectDataSocket.current.addEventListener('close', (e) => {
          console.log('connect_data_socket close', e);
        });
        connectDataSocket.current.addEventListener('error', (e) => {
          console.log('connect_data_socket error', e);
        });
      }

    }, false);
    connectSocket.current.addEventListener('close', (e) => {
      console.log('connect_socket close');
    });
  };

  React.useEffect(() => {
    const terminalContainerEl = ref.current;
    if (terminalContainerEl) {

      while (terminalContainerEl.children.length) {
        terminalContainerEl.removeChild(terminalContainerEl.children[0]);
      }
      term.current = new XTerm({
        macOptionIsMeta: false,
        cursorBlink: false,
        scrollback: 2500,
        tabStopWidth: 8,
        fontSize: 12,
      });

      term.current.open(terminalContainerEl);
      // term.winptyCompatInit();
      term.current.webLinksInit();

      term.current.on('resize', (size) => {
        const {cols, rows} = size;
        if (connectSocket.current && connectSocket.current.readyState === WebSocket.OPEN) {
          connectSocket.current.send(JSON.stringify({
            action: 'resize',
            payload: {
              cols, rows,
            },
          }));
        }
      });

      setTimeout(() => {
        term.current.fit();
        cols.current = term.current.cols;
        rows.current = term.current.rows;
        connectRemote();
      }, 0);

    }
  }, []);

  React.useEffect(() => {
    let windowTerminalResizeId;
    eventBus.on(ResizeEvent, (event: ResizeEvent) => {
      if (event.payload.slotLocation === getSlotLocation(pkgName, configContext.layoutConfig)) {
        clearTimeout(windowTerminalResizeId);
        windowTerminalResizeId = setTimeout(() => {
          if (term.current) {
            term.current.fit();
          }
        }, 20);
      }
    });
  }, []);

  return (
    <div className={styles.terminalWrap} ref={(el) => ref.current = el}/>
  );
});
