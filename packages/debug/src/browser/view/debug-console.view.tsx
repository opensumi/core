import * as React from 'react';
import * as cls from 'classnames';
import { observer } from 'mobx-react-lite';
import * as styles from './debug-console.module.less';
import { ViewState } from '@ali/ide-core-browser';
import { useInjectable, KeyCode, Key, TreeNode, ExpandableTreeNode } from '@ali/ide-core-browser';
import { DebugConsoleService } from './debug-console.service';
import { VariablesTree, Input, RecycleList } from '@ali/ide-core-browser/lib/components';
import { DebugVariable, ExpressionItem } from '../console/debug-console-items';

export const DebugConsoleView = observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const {
    nodes,
    execute,
  }: DebugConsoleService = useInjectable(DebugConsoleService);
  // TODO：待Layout实现宽高注入后替换该逻辑
  const debugConsoleRef = React.createRef<HTMLDivElement>();
  const [scrollContainerStyle, setScrollContainerStyle] = React.useState({});

  const [value, setValue] = React.useState('');

  const onChangeHandler = (event) => {
    setValue(event.target.value);
  };

  const onKeydownHandler = (event: React.KeyboardEvent) => {
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

  const template = ({data}: {
    data: TreeNode<any>,
  }) => {
    const renderContent = (data: TreeNode<any>) => {
      let NameTemplate;
      if (typeof data.name === 'function') {
        NameTemplate = data.name as React.JSXElementConstructor<any>;
      } else {
        NameTemplate = () => {
          return <div>{ data.name }</div>;
        };
      }
      const itemLineHeight = 20;
      if (data instanceof DebugVariable || data instanceof ExpressionItem) {
        return <div>
          <VariablesTree
            node={data}
            leftPadding={8}
            defaultLeftPadding={0}
            itemLineHeight={itemLineHeight}
          />
        </div>;
      } else {
        return <NameTemplate/>;
      }
    };
    return <div className={styles.debug_console_item}>
      <div className={cls(styles.debug_console_item_content, data.labelClass)}>
        {renderContent(data)}
      </div>
    </div>;
  };

  return <div className={styles.debug_console} ref={debugConsoleRef}>
    <RecycleList
      data = {nodes}
      template = {template}
      sliceSize = {100}
      style={scrollContainerStyle}
      scrollBottomIfActive={true}
    />
    <div className={styles.variable_repl_bar}>
      <Input
        type='text' placeholder=''
        className={styles.variable_repl_bar_input}
        value={value}
        onChange={onChangeHandler}
        onKeyDown={onKeydownHandler}
      />
    </div>
  </div>;
});
