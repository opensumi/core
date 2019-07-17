import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './toolbar.module.less';
import { IToolBarElement, IToolBarComponent, IToolBarAction, IToolBarViewService, ToolBarPosition } from './types';
import { useInjectable } from '@ali/ide-core-browser';
import { ToolBarViewService } from './toolbar.view.service';

export const ToolBar = observer(() => {

  const toolBarService = useInjectable(IToolBarViewService) as ToolBarViewService;

  return <div className={styles['tool-bar']} >
    <ToolBarElementContainer className={styles.left} elements={toolBarService.getVisibleElements(ToolBarPosition.LEFT)}/>
    <ToolBarElementContainer className={styles.center} elements={toolBarService.getVisibleElements(ToolBarPosition.CENTER)}/>
    <ToolBarElementContainer className={styles.right} elements={toolBarService.getVisibleElements(ToolBarPosition.RIGHT)}/>
  </div>;

});

export const ToolBarElementContainer = ({elements, className}: {elements: IToolBarElement[], className?: string}) => {

  return <div className={className}>
    {
      elements.map((e, i) => {
        if (e.type === 'component') {
          const C = (e as IToolBarComponent).component;
          return <div key= {'element-' + i}>
            <C />
          </div>;
        } else if (e.type === 'action') {
          return <ToolBarAction key= {'element-' + i} action={e as IToolBarAction}></ToolBarAction>;
        }
      })
    }
  </div>;
};

export const ToolBarAction = ({action}: {action: IToolBarAction}) => {

  const ref = React.useRef<HTMLDivElement>();

  return <div>
    <div className={action.iconClass + ' ' + styles.action} title={action.title} ref={ref as any} onMouseDown={() => {
      ref.current!.classList.add(styles.active);
    }} onMouseUp={() => {
      ref.current!.classList.remove(styles.active);
    }} onClick={() => {
      action.click();
    }}></div>
  </div>;
};
