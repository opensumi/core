import { observer } from 'mobx-react-lite';
import React from 'react';

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

export default observer((props: IResizeViewProps) => {
  const { group, shadow } = props;
  const [event, setEvent] = React.useState(false);
  const [wholeWidth, setWholeWidth] = React.useState(Infinity);
  const whole = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (whole.current && whole.current.clientHeight !== wholeWidth) {
      setWholeWidth(whole.current.clientWidth);
    }
  });

  return (
    <div className={styles.resizeWrapper} ref={whole}>
      <div
        style={{
          pointerEvents: event ? 'all' : 'none',
        }}
        className={styles.resizeDelegate}
      >
        {group &&
          group.widgets.map((widget, index) => {
            const left = index - 1 > -1 ? group.widgets[index - 1] : null;
            const self = group.widgets[index];
            const right = index + 1 < group.widgets.length ? group.widgets[index + 1] : null;
            return (
              <div
                key={`resize-item-${index}`}
                style={{ width: `${widget.shadowDynamic}%` }}
                className={styles.resizeHandler}
              >
                <ResizeDelegate
                  wholeWidth={wholeWidth}
                  start={() => setEvent(true)}
                  stop={() => setEvent(false)}
                  self={self}
                  left={left}
                  right={right}
                  last={index === group.widgets.length - 1}
                />
              </div>
            );
          })}
      </div>
      <div
        style={{
          pointerEvents: !event ? 'all' : 'none',
        }}
        className={styles.resizePanel}
      >
        {group &&
          group.widgets.map((widget) => (
            <div
              key={widget.id}
              style={{ width: `${shadow ? widget.dynamic : widget.shadowDynamic}%` }}
              className={styles.resizeItem}
            >
              {props.draw(widget)}
            </div>
          ))}
      </div>
    </div>
  );
});
