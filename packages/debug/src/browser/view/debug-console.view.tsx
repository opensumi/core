import * as React from 'react';
import * as cls from 'classnames';
import { observer } from 'mobx-react-lite';
import * as styles from './debug-console.module.less';
import { useInjectable, TreeNode } from '@ali/ide-core-browser';
import { DebugConsoleService } from './debug-console.service';
import { VariablesTree, RecycleList } from '@ali/ide-core-browser/lib/components';
import { DebugVariable, ExpressionItem } from '../console/debug-console-items';

export const DebugConsoleView = observer(() => {
  const { nodes, createConsoleInput } = useInjectable<DebugConsoleService>(DebugConsoleService);
  const debugConsoleRef = React.createRef<HTMLDivElement>();
  const debugInputRef = React.createRef<HTMLDivElement>();
  const [scrollContainerStyle, setScrollContainerStyle] = React.useState({});

  React.useEffect(() => {
    const container = debugInputRef.current;
    createConsoleInput(container!);
  }, [debugInputRef.current]);

  React.useEffect(() => {
    setScrollContainerStyle({
      width: '100%',
    });
  }, [debugConsoleRef.current]);

  const template = ({ data }: {
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
            node={ data }
            leftPadding={ 8 }
            defaultLeftPadding={ 0 }
            itemLineHeight={ itemLineHeight }
          />
        </div>;
      } else {
        return <NameTemplate />;
      }
    };
    return <div className={ styles.debug_console_item }>
      <div className={ cls(styles.debug_console_item_content, data.labelClass) }>
        { renderContent(data) }
      </div>
    </div>;
  };

  return <div className={ styles.debug_console } ref={ debugConsoleRef }>
    <RecycleList
      data={ nodes }
      template={ template }
      sliceSize={ 100 }
      style={ scrollContainerStyle }
      scrollBottomIfActive={ true }
    />
    <div className={ styles.variable_repl_bar }>
      <div className={ styles.variable_repl_editor } ref={ debugInputRef }></div>
    </div>
  </div>;
});
