import {
  LineRangeMapping as MonacoLineRangeMapping,
  RangeMapping,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';

import { LineRange } from './line-range';

export class LineRangeMapping extends MonacoLineRangeMapping {
  constructor(originalRange: LineRange, modifiedRange: LineRange, innerChanges: RangeMapping[] | undefined) {
    super(originalRange, modifiedRange, innerChanges);
  }
}
