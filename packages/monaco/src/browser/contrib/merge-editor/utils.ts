import { DetailedLineRangeMapping } from '../../../common/diff';

import { InnerRange } from './model/inner-range';
import { LineRange } from './model/line-range';

export const flatOriginal = (changes: readonly DetailedLineRangeMapping[]): LineRange[] =>
  changes.map((c) => c.original as LineRange);

export const flatInnerOriginal = (changes: DetailedLineRangeMapping[]): InnerRange[][] =>
  changes
    .map((c) => c.innerChanges)
    .filter(Boolean)
    .map((m) => m!.map((m) => m.originalRange as InnerRange));

export const flatModified = (changes: readonly DetailedLineRangeMapping[]): LineRange[] =>
  changes.map((c) => c.modified as LineRange);

export const flatInnerModified = (changes: DetailedLineRangeMapping[]): InnerRange[][] =>
  changes
    .map((c) => c.innerChanges)
    .filter(Boolean)
    .map((m) => m!.map((m) => m.modifiedRange as InnerRange));
