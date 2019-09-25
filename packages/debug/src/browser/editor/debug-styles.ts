export enum TrackedRangeStickiness {
  AlwaysGrowsWhenTypingAtEdges = 0,
  NeverGrowsWhenTypingAtEdges = 1,
  GrowsOnlyWhenTypingBefore = 2,
  GrowsOnlyWhenTypingAfter = 3,
}

export const BREAK_PONINT_HOVER_MARGIN: monaco.editor.IModelDecorationOptions = {
  glyphMarginClassName: 'kaitian-debug-hover',
  linesDecorationsClassName: 'kaitian-debug-hover',
  isWholeLine: true,
};

export const BREAK_PONINT_ADDED_MARGIN: monaco.editor.IModelDecorationOptions = {
  glyphMarginClassName: 'kaitian-debug-breakpoint',
  isWholeLine: true,
};

export const TOP_STACK_FRAME_MARGIN: monaco.editor.IModelDecorationOptions = {
  glyphMarginClassName: 'kaitian-debug-top-stack-frame',
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
};

export const FOCUSED_STACK_FRAME_MARGIN: monaco.editor.IModelDecorationOptions = {
  glyphMarginClassName: 'kaitian-debug-focused-stack-frame',
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
};

export const TOP_STACK_FRAME_DECORATION: monaco.editor.IModelDecorationOptions = {
  isWholeLine: true,
  className: 'kaitian-debug-top-stack-frame-line',
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
};

export const TOP_STACK_FRAME_EXCEPTION_DECORATION: monaco.editor.IModelDecorationOptions = {
  isWholeLine: true,
  className: 'kaitian-debug-top-stack-frame-exception-line',
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
};

export const FOCUSED_STACK_FRAME_DECORATION: monaco.editor.IModelDecorationOptions = {
  isWholeLine: true,
  className: 'kaitian-debug-focused-stack-frame-line',
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
};

export const TOP_STACK_FRAME_INLINE_DECORATION: monaco.editor.IModelDecorationOptions = {
  beforeContentClassName: 'kaitian-debug-top-stack-frame-column',
};
