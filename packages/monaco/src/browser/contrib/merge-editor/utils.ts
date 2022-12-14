import { InnerRange } from './model/inner-range';
import { LineRange } from './model/line-range';
import { LineRangeMapping } from './model/line-range-mapping';

export const flatOriginal = (changes: LineRangeMapping[]): LineRange[] =>
  changes.map((c) => c.originalRange as LineRange);

export const flatInnerOriginal = (changes: LineRangeMapping[]): InnerRange[][] =>
  changes
    .map((c) => c.innerChanges)
    .filter(Boolean)
    .map((m) => m!.map((m) => m.originalRange as InnerRange));

export const flatModified = (changes: LineRangeMapping[]): LineRange[] =>
  changes.map((c) => c.modifiedRange as LineRange);

export const flatInnerModified = (changes: LineRangeMapping[]): InnerRange[][] =>
  changes
    .map((c) => c.innerChanges)
    .filter(Boolean)
    .map((m) => m!.map((m) => m.modifiedRange as InnerRange));
