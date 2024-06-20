import * as monaco from '../../../common';

export interface INavigationResults {
  canNavigate: boolean;
  range?: monaco.Range;
}

export enum NavigationDirection {
  Forwards,
  Backwards,
}

export function findRangeForNavigation(
  direction: NavigationDirection,
  ranges: monaco.Range[],
  currentPosition: monaco.Position,
): INavigationResults | null {
  if (!ranges || ranges.length === 0) {
    return null;
  }

  if (!currentPosition) {
    return null;
  }

  if (ranges.length === 1) {
    if (ranges[0].containsPosition(currentPosition)) {
      return {
        canNavigate: false,
      };
    }

    return {
      canNavigate: true,
      range: ranges[0],
    };
  }

  let predicate: (_conflict: any) => boolean;
  let fallback: () => monaco.Range;
  let scanOrder: monaco.Range[];

  if (direction === NavigationDirection.Forwards) {
    predicate = (range: monaco.Range) => monaco.Position.isBefore(currentPosition, range.getStartPosition());
    fallback = () => ranges![0];
    scanOrder = ranges;
  } else if (direction === NavigationDirection.Backwards) {
    predicate = (range: monaco.Range) => monaco.Position.isBefore(range.getStartPosition(), currentPosition);
    fallback = () => ranges![ranges!.length - 1];
    scanOrder = ranges.slice().reverse();
  } else {
    throw new Error(`Unsupported direction ${direction}`);
  }

  for (const range of scanOrder) {
    if (predicate(range) && !range.containsPosition(currentPosition)) {
      return {
        canNavigate: true,
        range,
      };
    }
  }

  // Went all the way to the end, return the head
  return {
    canNavigate: true,
    range: fallback(),
  };
}
