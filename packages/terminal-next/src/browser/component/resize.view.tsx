import cls from 'classnames';
import React from 'react';

import { getIcon, useAutorun, useInjectable } from '@opensumi/ide-core-browser';

import { ITerminalGroupViewService } from '../../common/controller';
import { IWidget, IWidgetGroup } from '../../common/resize';

import ResizeDelegate from './resize.delegate';
import styles from './resize.module.less';

export enum ResizeDirection {
  vertical,
  horizontal,
}

export interface IResizeViewProps {
  direction: ResizeDirection;
  useFlex: boolean;
  shadow: boolean;
  group: IWidgetGroup;
  draw: (widget: IWidget) => JSX.Element;
}

const ResizeItem = ({ index, widget, wholeWidth, setEvent, self, left, right, last }) => {
  const shadowDynamic = useAutorun(widget.shadowDynamic);
  return (
    <div key={`resize-item-${index}`} style={{ width: `${shadowDynamic}%` }} className={styles.resizeHandler}>
      <ResizeDelegate
        wholeWidth={wholeWidth}
        start={() => setEvent(true)}
        stop={() => setEvent(false)}
        self={self}
        left={left}
        right={right}
        last={last}
      />
    </div>
  );
};

const ResizePanelItem = ({ widget, dynamic, draw, handleRemoveWidget, widgetsLength }) => {
  const _dynamic = useAutorun(dynamic);

  return (
    <div key={widget.id} style={{ width: `${_dynamic}%` }} className={styles.resizeItem}>
      {draw(widget)}
      {widgetsLength > 1 && (
        <div
          className={cls(styles.closeBtn, getIcon('close'))}
          onClick={() => {
            handleRemoveWidget(widget.id);
          }}
        />
      )}
    </div>
  );
};

export default (props: IResizeViewProps) => {
  const { group, shadow } = props;
  const widgets = useAutorun(group.widgets);

  const [event, setEvent] = React.useState(false);
  const [wholeWidth, setWholeWidth] = React.useState(Infinity);
  const view = useInjectable<ITerminalGroupViewService>(ITerminalGroupViewService);
  const whole = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (whole.current && whole.current.clientHeight !== wholeWidth) {
      setWholeWidth(whole.current.clientWidth);
    }
  });

  const handleRemoveWidget = React.useCallback((widgetId: string) => {
    view.removeWidget(widgetId);
  }, []);

  return (
    <div className={styles.resizeWrapper} ref={whole}>
      <div style={{ pointerEvents: event ? 'all' : 'none' }} className={styles.resizeDelegate}>
        {widgets &&
          widgets.map((widget, index) => {
            const left = index - 1 > -1 ? widgets[index - 1] : null;
            const self = widgets[index];
            const right = index + 1 < widgets.length ? widgets[index + 1] : null;

            return (
              <ResizeItem
                key={index}
                index={index}
                widget={widget}
                wholeWidth={wholeWidth}
                setEvent={setEvent}
                self={self}
                left={left}
                right={right}
                last={index === widgets.length - 1}
              />
            );
          })}
      </div>
      <div style={{ pointerEvents: !event ? 'all' : 'none' }} className={styles.resizePanel}>
        {widgets &&
          widgets.map((widget) => (
            <ResizePanelItem
              key={widget.id}
              widget={widget}
              dynamic={shadow ? widget.dynamic : widget.shadowDynamic}
              draw={props.draw}
              handleRemoveWidget={handleRemoveWidget}
              widgetsLength={widgets.length}
            />
          ))}
      </div>
    </div>
  );
};
