import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { observer } from 'mobx-react-lite';
import { loadMonaco, loadVsRequire } from './monaco-loader';
import { useInjectable } from '@ali/ide-core-browser';
import MonacoService from './monaco.service';

import './index.css';

export const Monaco = observer(() => {
  const ref = React.useRef<HTMLElement | null>();

  const instance = useInjectable(MonacoService);

  React.useEffect(() => {
    if (ref.current) {
      loadVsRequire(window).then((vsRequire) => {
        loadMonaco(vsRequire).then(async () => {
          await instance.initMonaco(ref.current as HTMLElement);
        });
      });
    }
  }, [ref]);
  return (
    <div className='monaco-wrap' ref={(ele) => ref.current = ele}></div>
  );
});
