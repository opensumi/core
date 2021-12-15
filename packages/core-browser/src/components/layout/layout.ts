import { ResizeHandleVertical, ResizeHandleHorizontal } from '../resize/resize';

const flexDirectionMap: {
  [index: string]: {
    direction: any;
    size: 'width' | 'height';
    domSize: 'clientWidth' | 'clientHeight';
    minSize: 'minWidth' | 'minHeight';
    maxSize: 'maxWidth' | 'maxHeight';
  };
} = {
  'left-to-right': {
    direction: 'row',
    size: 'width',
    domSize: 'clientHeight',
    minSize: 'minWidth',
    maxSize: 'maxWidth',
  },
  'right-to-left': {
    direction: 'row-reverse',
    size: 'width',
    domSize: 'clientHeight',
    minSize: 'minWidth',
    maxSize: 'maxWidth',
  },
  'top-to-bottom': {
    direction: 'column',
    size: 'height',
    domSize: 'clientWidth',
    minSize: 'minHeight',
    maxSize: 'maxHeight',
  },
  'bottom-to-top': {
    direction: 'column-reverse',
    size: 'height',
    domSize: 'clientWidth',
    minSize: 'minHeight',
    maxSize: 'maxHeight',
  },
};

export namespace Layout {
  export type direction = 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top';

  export type alignment = 'horizontal' | 'vertical';

  export function getFlexDirection(direction: Layout.direction) {
    return flexDirectionMap[direction].direction;
  }

  export function getSizeProperty(direction: Layout.direction) {
    return flexDirectionMap[direction].size;
  }

  export function getDomSizeProperty(direction: Layout.direction) {
    return flexDirectionMap[direction].domSize;
  }

  export function getMinSizeProperty(direction: Layout.direction) {
    return flexDirectionMap[direction].minSize;
  }

  export function getMaxSizeProperty(direction: Layout.direction) {
    return flexDirectionMap[direction].maxSize;
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
