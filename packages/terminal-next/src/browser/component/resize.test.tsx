import * as React from 'react';
import ResizeView, { ResizeDirection } from './resize.view';
import { WidgetGroup } from './resize.control';
import { IWidget } from '../../common/resize';

export default () => {
  const group = new WidgetGroup();

  React.useEffect(() => {
    group.firstInitialize();

    setTimeout(() => {
      group.createWidget();
    }, 2000);
  }, []);

  const renderWidget = (widget: IWidget) => {
    return (
      <div
        style={ {
          width: '100%',
          height: '100%',
        } }
      >
        { widget.id }
      </div>
    );
  };

  return (
    <ResizeView
      useFlex={ false }
      direction={ ResizeDirection.horizontal }
      group={ group }
      draw={ (widget: IWidget) => renderWidget(widget) }
    />
  );
};
