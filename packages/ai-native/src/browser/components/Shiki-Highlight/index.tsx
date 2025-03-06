import React, { memo, useEffect, useRef, useState } from 'react';
import { ThemeInput, createHighlighter, createJavaScriptRegexEngine } from 'shiki';
import { CodeToTokenTransformStream } from 'shiki-stream';
import { ShikiStreamRenderer } from 'shiki-stream/react';

import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { WorkbenchThemeService } from '@opensumi/ide-theme/lib/browser/workbench.theme.service';
import { ITheme, IThemeService } from '@opensumi/ide-theme/lib/common/theme.service';

export interface ShikiHighlightProps {
  input: string;
  language?: string;
}

export const ShikiHighlight = memo(({ input, language = 'text' }: ShikiHighlightProps) => {
  const highlighterRef = useRef<any>(null);
  const controllerRef = useRef<ReadableStreamDefaultController | null>(null);
  const prevInputRef = useRef('');
  const workbenchThemeService = useInjectable<WorkbenchThemeService>(IThemeService);
  const containerRef = useRef<HTMLDivElement>(null);

  const [bufferStreams, setBufferStreams] = useState<{
    current: ReadableStream | null;
    next: ReadableStream | null;
  }>({ current: null, next: null });

  // 创建新流
  const createNewStream = async (theme: ITheme) => {
    const highlighter = await createHighlighter({
      langs: [language],
      themes: [convertTheme(theme)],
      engine: createJavaScriptRegexEngine(),
    });

    await highlighter.loadTheme(convertTheme(theme));

    // 创建可控制的流
    let streamController: ReadableStreamDefaultController;
    const stream = new ReadableStream({
      start(controller) {
        streamController = controller;
        controller.enqueue(input);
        prevInputRef.current = input;
      },
    });

    const tokenStream = stream.pipeThrough(
      new CodeToTokenTransformStream({
        highlighter,
        lang: language,
        themes: {
          light: theme.themeData.name,
          dark: theme.themeData.name,
        },
        allowRecalls: true,
      }),
    );

    return {
      tokenStream,
      controller: streamController!,
      highlighter,
    };
  };

  const resetHighlighter = async (theme: ITheme) => {
    try {
      // 创建新流
      const { tokenStream, controller, highlighter } = await createNewStream(theme);

      // 先设置为下一个流
      setBufferStreams((prev) => ({
        current: prev.current,
        next: tokenStream,
      }));

      // 等待一个渲染周期
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 更新控制器和高亮器引用
      if (controllerRef.current) {
        controllerRef.current.close();
      }
      controllerRef.current = controller;
      highlighterRef.current = highlighter;

      // 切换到新流
      setBufferStreams((prev) => ({
        current: prev.next,
        next: null,
      }));

    } catch {
    }
  };

  // 初始化
  useEffect(() => {
    const initHighlighter = async () => {
      const currentTheme = workbenchThemeService.getCurrentThemeSync();
      await resetHighlighter(currentTheme);
    };

    initHighlighter();
  }, [language]);

  // 监听主题变化
  useEffect(() => {
    const dispose = workbenchThemeService.onThemeChange((newTheme) => {
      resetHighlighter(newTheme);
    });
    return () => dispose.dispose();
  }, []);

  // 处理输入更新
  useEffect(() => {
    if (!controllerRef.current || input === prevInputRef.current) {
      return;
    }

    const diff = input.slice(prevInputRef.current.length);
    if (diff) {
      controllerRef.current.enqueue(diff);
      prevInputRef.current = input;
    }
  }, [input]);

  return (
    <div ref={containerRef}>{bufferStreams.current && <ShikiStreamRenderer stream={bufferStreams.current} />}</div>
  );
});

// 主题转换函数保持不变
function convertTheme(theme: ITheme): ThemeInput {
  return {
    name: theme.themeData.name,
    settings: theme.themeData.settings,
    tokenColors: theme.themeData.tokenColors || [],
  };
}
