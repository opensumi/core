import { RawContextKey } from '../raw-context-key';

export const OutlineSortTypeContext = new RawContextKey<number>('outlineSortType', 0);
export const OutlineFollowCursorContext = new RawContextKey<boolean>('outlineFollowCursor', false);
