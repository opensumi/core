import { InnerRange } from './model/inner-range';
import { LineRange } from './model/line-range';
import { LineRangeMapping } from './model/line-range-mapping';

export const flatOriginal = (changes: readonly LineRangeMapping[]): LineRange[] =>
  changes.map((c) => c.original as LineRange);

export const flatInnerOriginal = (changes: LineRangeMapping[]): InnerRange[][] =>
  changes
    .map((c) => c.innerChanges)
    .filter(Boolean)
    .map((m) => m!.map((m) => m.originalRange as InnerRange));

export const flatModified = (changes: readonly LineRangeMapping[]): LineRange[] =>
  changes.map((c) => c.modified as LineRange);

export const flatInnerModified = (changes: LineRangeMapping[]): InnerRange[][] =>
  changes
    .map((c) => c.innerChanges)
    .filter(Boolean)
    .map((m) => m!.map((m) => m.modifiedRange as InnerRange));
