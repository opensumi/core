import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { LineRange, LineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';

export const flatOriginal = (changes: LineRangeMapping[]): LineRange[] => changes.map((c) => c.originalRange);

export const flatInnerOriginal = (changes: LineRangeMapping[]): Range[] => changes
    .map((c) => c.innerChanges)
    .filter(Boolean)
    .flatMap((m) => m!.map((m) => m.originalRange));

export const flatModified = (changes: LineRangeMapping[]): LineRange[] => changes.map((c) => c.modifiedRange);

export const flatInnerModified = (changes: LineRangeMapping[]): Range[] => changes
    .map((c) => c.innerChanges)
    .filter(Boolean)
    .flatMap((m) => m!.map((m) => m.modifiedRange));
