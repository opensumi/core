import { ResizeHandleHorizontal, ResizeHandleVertical } from '../resize/resize';

export const enum EDirection {
  LeftToRight = 'left-to-right',
  RightToLeft = 'right-to-left',
  TopToBottom = 'top-to-bottom',
  BottomToTop = 'bottom-to-top',
}

const flexDirectionMap: {
  [index: string]: {
    direction: any;
    size: 'width' | 'height';
    domSize: 'clientWidth' | 'clientHeight';
    minSize: 'minWidth' | 'minHeight';
    maxSize: 'maxWidth' | 'maxHeight';
  };
} = {
  [EDirection.LeftToRight]: {
    direction: 'row',
    size: 'width',
    domSize: 'clientHeight',
    minSize: 'minWidth',
    maxSize: 'maxWidth',
  },
  [EDirection.RightToLeft]: {
    direction: 'row-reverse',
    size: 'width',
    domSize: 'clientHeight',
    minSize: 'minWidth',
    maxSize: 'maxWidth',
  },
  [EDirection.TopToBottom]: {
    direction: 'column',
    size: 'height',
    domSize: 'clientWidth',
    minSize: 'minHeight',
    maxSize: 'maxHeight',
  },
  [EDirection.BottomToTop]: {
    direction: 'column-reverse',
    size: 'height',
    domSize: 'clientWidth',
    minSize: 'minHeight',
    maxSize: 'maxHeight',
  },
};

export namespace Layout {
  export type direction = EDirection | `${EDirection}`;

  export type alignment = 'horizontal' | 'vertical';

  export function getStyleProperties(direction: Layout.direction) {
    return flexDirectionMap[direction];
  }

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
    if (direction === EDirection.BottomToTop || direction === EDirection.TopToBottom) {
      return ResizeHandleVertical;
    }
    return ResizeHandleHorizontal;
  }

  export function getTabbarDirection(direction: Layout.direction) {
    if (direction === EDirection.BottomToTop || direction === EDirection.TopToBottom) {
      return 'row';
    }
    return 'column';
  }
}
