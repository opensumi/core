import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

export const STICKINESS = monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges;

export const BREAK_PONINT_HOVER_MARGIN: monaco.editor.IModelDecorationOptions = {
  description: 'debug-hover',
  glyphMarginClassName: 'kaitian-debug-hover',
  linesDecorationsClassName: 'kaitian-debug-hover',
  isWholeLine: true,
};

export const TOP_STACK_FRAME_MARGIN: monaco.editor.IModelDecorationOptions = {
  description: 'debug-top-stack-frame',
  glyphMarginClassName: 'kaitian-debug-top-stack-frame',
  stickiness: STICKINESS,
};

export const FOCUSED_STACK_FRAME_MARGIN: monaco.editor.IModelDecorationOptions = {
  description: 'debug-focused-stack-frame',
  glyphMarginClassName: 'kaitian-debug-focused-stack-frame',
  stickiness: STICKINESS,
};

export const TOP_STACK_FRAME_DECORATION: monaco.editor.IModelDecorationOptions = {
  description: 'debug-top-stack-frame-line',
  isWholeLine: true,
  className: 'kaitian-debug-top-stack-frame-line',
  stickiness: STICKINESS,
};

export const TOP_STACK_FRAME_EXCEPTION_DECORATION: monaco.editor.IModelDecorationOptions = {
  description: 'debug-top-stack-frame-exception-line',
  isWholeLine: true,
  className: 'kaitian-debug-top-stack-frame-exception-line',
  stickiness: STICKINESS,
};

export const FOCUSED_STACK_FRAME_DECORATION: monaco.editor.IModelDecorationOptions = {
  description: 'debug-focused-stack-frame-line',
  isWholeLine: true,
  className: 'kaitian-debug-focused-stack-frame-line',
  stickiness: STICKINESS,
};

export const TOP_STACK_FRAME_INLINE_DECORATION: monaco.editor.IModelDecorationOptions = {
  description: 'debug-top-stack-frame-column',
  beforeContentClassName: 'kaitian-debug-top-stack-frame-column',
};

export const BREAKPOINT_HINT_DECORATION: monaco.editor.IModelDecorationOptions = {
  description: 'debug-breakpoint-hint',
  glyphMarginClassName: 'kaitian-debug-breakpoint-hint',
  stickiness: STICKINESS,
};

export const BREAKPOINT_DECORATION: monaco.editor.IModelDecorationOptions = {
  description: 'debug-breakpoint',
  glyphMarginClassName: 'kaitian-debug-breakpoint',
  stickiness: STICKINESS,
};

export const BREAKPOINT_DECORATION_DISABLED: monaco.editor.IModelDecorationOptions = {
  description: 'debug-breakpoint-disabled',
  glyphMarginClassName: 'kaitian-debug-breakpoint-disabled',
  stickiness: STICKINESS,
};
