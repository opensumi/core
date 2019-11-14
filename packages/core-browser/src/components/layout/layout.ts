import { ResizeHandleVertical, ResizeHandleHorizontal } from '../resize/resize';

const flexDirectionMap: { [index: string]: { direction: any; size: 'width' | 'height'; } } = {
  'left-to-right': {
    direction: 'row',
    size: 'width',
  },
  'right-to-left': {
    direction: 'row-reverse',
    size: 'width',
  },
  'top-to-bottom': {
    direction: 'column',
    size: 'height',
  },
  'bottom-to-top': {
    direction: 'column-reverse',
    size: 'height',
  },
};

export namespace Layout {
  export type direction = ('left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top');

  export function getFlexDirection(direction: Layout.direction) {
    return flexDirectionMap[direction].direction;
  }

  export function getSizeProperty(direction: Layout.direction) {
    return flexDirectionMap[direction].size;
  }

  export function getResizeHandle(direction: Layout.direction) {
    if (direction === 'bottom-to-top' || direction === 'top-to-bottom') {
      return ResizeHandleVertical;
    }
    return ResizeHandleHorizontal;
  }

  export function getTabbarDirection(direction: Layout.direction) {
    if (direction === 'bottom-to-top' || direction === 'top-to-bottom') {
      return 'row';
    }
    return 'column';
  }
}
