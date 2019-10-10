import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './debug-console.module.less';
import { ViewState } from '@ali/ide-activity-panel';
import { useInjectable } from '@ali/ide-core-browser';
import { DebugStackFramesService } from './debug-console.service';
import { SourceTree } from '@ali/ide-core-browser/lib/components';

export const DebugConsoleView = observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const {
    nodes,
    onSelect,
    execute,
  }: DebugStackFramesService = useInjectable(DebugStackFramesService);
  // TODO：待Layout实现宽高注入后替换该逻辑
  const debugConsoleRef = React.createRef<HTMLDivElement>();
  const [scrollContainerStyle, setScrollContainerStyle] = React.useState({});

  const [value, setValue] = React.useState('');

  const onChangeHandler = (event) => {
    setValue(event.target.value);
  };

  const onKeydownHanlder = (event: React.KeyboardEvent) => {
    if (event.keyCode === 13) {
      event.stopPropagation();
      event.preventDefault();
      execute(value);
      setValue('');
    }
  };

  React.useEffect(() => {
    setScrollContainerStyle({
      width: '100%',
    });
  }, [debugConsoleRef.current]);
  return <div className={styles.debug_console} ref={debugConsoleRef}>
    <SourceTree
      nodes={nodes}
      onSelect={onSelect}
      outline={false}
      scrollContainerStyle={scrollContainerStyle}
    />
    <div className={styles.variable_repl_bar}>
      <input
        type='text' placeholder=''
        value={value}
        onChange={onChangeHandler}
        onKeyDown={onKeydownHanlder}
        />
    </div>
  </div>;
});
