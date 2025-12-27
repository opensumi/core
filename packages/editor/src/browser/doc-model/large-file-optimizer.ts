import * as monaco from '@opensumi/ide-monaco';

export interface ILargeFileOptimizationOptions {
  optimizedMode?: boolean;
  disableSemanticHighlighting?: boolean;
  disableWordWrap?: boolean;
  disableMinimap?: boolean;
  disableHover?: boolean;
  disableCodeLens?: boolean;
  disableQuickSuggestions?: boolean;
}

/**
 * 为大文件生成优化的 Monaco 编辑器选项
 */
export function getLargeFileOptimizedEditorOptions(
  baseOptions: monaco.editor.IEditorOptions = {},
  optimizations: ILargeFileOptimizationOptions = {},
): monaco.editor.IEditorOptions {
  const optimizedOptions: monaco.editor.IEditorOptions = { ...baseOptions };

  if (optimizations.optimizedMode) {
    // 基础性能优化
    optimizedOptions.scrollBeyondLastLine = false;
    optimizedOptions.smoothScrolling = false;
    optimizedOptions.automaticLayout = false;
    optimizedOptions.renderLineHighlight = 'none';
    optimizedOptions.folding = false;
    optimizedOptions.showFoldingControls = 'never';

    // 禁用性能消耗大的功能
    optimizedOptions.occurrencesHighlight = 'off';
    optimizedOptions.selectionHighlight = false;
    optimizedOptions.renderControlCharacters = false;
    optimizedOptions.renderWhitespace = 'none';

    // 大文件特殊优化
    optimizedOptions.stopRenderingLineAfter = 10000; // 限制行渲染长度
    optimizedOptions.dragAndDrop = false; // 禁用拖拽

    // 优化渲染性能
    optimizedOptions.fastScrollSensitivity = 10;
    optimizedOptions.mouseWheelScrollSensitivity = 3;
  }

  if (optimizations.disableWordWrap) {
    optimizedOptions.wordWrap = 'off';
  }

  if (optimizations.disableMinimap) {
    optimizedOptions.minimap = { enabled: false };
  }

  if (optimizations.disableHover) {
    optimizedOptions.hover = { enabled: false };
  }

  if (optimizations.disableCodeLens) {
    optimizedOptions.codeLens = false;
  }

  if (optimizations.disableQuickSuggestions) {
    optimizedOptions.quickSuggestions = false;
    optimizedOptions.suggestOnTriggerCharacters = false;
  }

  return optimizedOptions;
}

/**
 * 检查文件是否需要优化处理
 */
export function shouldOptimizeForLargeFile(fileSizeBytes: number, content?: string): boolean {
  const SIZE_THRESHOLD = 10 * 1024 * 1024; // 10MB
  const LINE_THRESHOLD = 50000; // 50k 行

  if (fileSizeBytes > SIZE_THRESHOLD) {
    return true;
  }

  if (content && content.split('\n').length > LINE_THRESHOLD) {
    return true;
  }

  return false;
}

/**
 * 从资源元数据中提取优化选项
 */
export function extractOptimizationOptions(metadata: any = {}): ILargeFileOptimizationOptions {
  return {
    optimizedMode: metadata.optimizedMode,
    disableSemanticHighlighting: metadata.disableSemanticHighlighting,
    disableWordWrap: metadata.disableWordWrap,
    disableMinimap: metadata.disableMinimap,
    disableHover: metadata.disableHover,
    disableCodeLens: metadata.disableCodeLens,
    disableQuickSuggestions: metadata.disableQuickSuggestions,
  };
}
