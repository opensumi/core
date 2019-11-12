import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './resize.module.less';
import ResizeDelegate from './resize.delegate';
import { IWidget, IWidgetGroup } from '../../common/resize';

export enum ResizeDirection {
  vertical,
  horizontal,
}

export interface IResizeViewProps {
  direction: ResizeDirection;
  useFlex: boolean;
  group: IWidgetGroup;
  draw: (widget: IWidget) => JSX.Element;
}

export default observer((props: IResizeViewProps) => {
  const { group } = props;
  const [event, setEvent] = React.useState(false);

  return (
    <div className={ styles.resizeWrapper }>
      <div
        style={ {
          pointerEvents: !event ? 'all' : 'none',
        } }
        className={ styles.resizePanel }
      >
        {
          group && group.widgets.map((widget) => {
            return (
              <div
                style={ { width: `${widget.dynamic}%` } }
                className={ styles.resizeItem }
              >
                {
                  props.draw(widget)
                }
              </div>
            );
          })
        }
      </div>
      <div
        style={ {
          pointerEvents: event ? 'all' : 'none',
        } }
        className={ styles.resizeDelegate }
      >
        {
          group && group.widgets.map((widget, index) => {
            const left = index - 1 > -1 ? group.widgets[index - 1] : null;
            const self = group.widgets[index];
            const right = index + 1 < group.widgets.length ? group.widgets[index + 1] : null;
            return (
              <div
                style={ { width: `${widget.dynamic}%` } }
                className={ styles.resizeHandler }
              >
                <ResizeDelegate
                  start={ () => setEvent(true) }
                  stop={ () => setEvent(false) }
                  self={ self }
                  left={ left }
                  right={ right }
                />
              </div>
            );
          })
        }
      </div>
    </div>
  );
});
