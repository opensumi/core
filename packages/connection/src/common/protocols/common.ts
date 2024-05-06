import { Type } from '@furyjs/fury';

export const UriComponentsProto = Type.object('uri-components', {
  scheme: Type.string(),
  authority: Type.string(),
  path: Type.string(),
  query: Type.string(),
  fragment: Type.string(),
});

export const RangeProto = Type.object('range', {
  startLineNumber: Type.uint32(),
  startColumn: Type.uint32(),
  endLineNumber: Type.uint32(),
  endColumn: Type.uint32(),
});

export const SelectionProto = Type.object('selection', {
  selectionStartLineNumber: Type.uint32(),
  selectionStartColumn: Type.uint32(),
  positionLineNumber: Type.uint32(),
  positionColumn: Type.uint32(),
});

export const PositionProto = Type.object('position', {
  lineNumber: Type.uint32(),
  column: Type.uint32(),
});
