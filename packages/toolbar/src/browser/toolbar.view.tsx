import clx from 'classnames';
import debounce = require('lodash.debounce');
import { observer } from 'mobx-react-lite';
import React from 'react';

import { ToolbarLocation, Disposable } from '@opensumi/ide-core-browser';

import styles from './toolbar.module.less';


declare let ResizeObserver: any;

export const ToolBar = observer<Pick<React.HTMLProps<HTMLElement>, 'className'>>(({ className }) => {
  const toolbarRef = React.useRef<HTMLDivElement>();
  React.useEffect(() => {
    if (toolbarRef.current) {
      const disposer = new Disposable();
      const leftLocation = document.getElementById('toolbar-location-toolbar-left')!;
      const centerLocation = document.getElementById('toolbar-location-toolbar-center')!;
      const rightLocation = document.getElementById('toolbar-location-toolbar-right')!;
      const space1 = document.getElementById(styles.space1)!;

      function setStyle() {
        if (!toolbarRef.current) {
          return;
        }
        const leftWidth = leftLocation.offsetWidth;
        const centerWidth = centerLocation.offsetWidth;
        const space1Width = Math.floor(
          Math.max(0, toolbarRef.current.offsetWidth * 0.5 - leftWidth - centerWidth * 0.5),
        );
        space1.style.width = space1Width + 'px';
        rightLocation.style.width = toolbarRef.current.offsetWidth - leftWidth - centerWidth - space1Width + 'px';
      }
      setStyle();

      const debouncedSetStyle = debounce(setStyle, 100, { maxWait: 200 });

      const observer = new ResizeObserver((entries) => {
        debouncedSetStyle();
      });

      observer.observe(toolbarRef.current);
      observer.observe(leftLocation);
      observer.observe(centerLocation);
      disposer.addDispose({
        dispose: () => {
          observer.disconnect();
        },
      });

      return () => disposer.dispose();
    }
  }, []);

  return (
    <div className={clx(styles['tool-bar'], className)} ref={toolbarRef as any}>
      <ToolbarLocation className={styles.left} location='toolbar-left' preferences={{ noDropDown: true }} />
      <div id={styles.space1}></div>
      <ToolbarLocation className={styles.center} location='toolbar-center' preferences={{ noDropDown: true }} />
      <ToolbarLocation className={styles.right} location='toolbar-right' />
    </div>
  );
});
