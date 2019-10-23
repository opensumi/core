import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './debug-console.module.less';
import { ViewState } from '@ali/ide-activity-panel';
import { useInjectable, KeyCode, Key } from '@ali/ide-core-browser';
import { DebugConsoleService } from './debug-console.service';
import { SourceTree, Input } from '@ali/ide-core-browser/lib/components';

export const DebugConsoleView = observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const {
    nodes,
    onSelect,
    execute,
  }: DebugConsoleService = useInjectable(DebugConsoleService);
  // TODO：待Layout实现宽高注入后替换该逻辑
  const debugConsoleRef = React.createRef<HTMLDivElement>();
  const [scrollContainerStyle, setScrollContainerStyle] = React.useState({});

  const [value, setValue] = React.useState('');

  const onChangeHandler = (event) => {
    setValue(event.target.value);
  };

  const onKeydownHanlder = (event: React.KeyboardEvent) => {
    const { key } = KeyCode.createKeyCode(event.nativeEvent);
    if (key && Key.ENTER.keyCode === key.keyCode) {
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
      <Input
        type='text' placeholder=''
        value={value}
        onChange={onChangeHandler}
        onKeyDown={onKeydownHanlder}
      />
    </div>
  </div>;
});
