import React, { memo, useEffect, useRef, useState } from 'react';
import { createHighlighter, createJavaScriptRegexEngine, ThemeInput } from 'shiki';
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
  const [tokensStream, setTokensStream] = useState<ReadableStream | null>(null);
  const highlighterRef = useRef<any>(null);
  const controllerRef = useRef<ReadableStreamDefaultController | null>(null);
  const prevInputRef = useRef('');
  const workbenchThemeService = useInjectable<WorkbenchThemeService>(IThemeService);
  const [currentTheme, setCurrentTheme] = useState<ITheme>(workbenchThemeService.getCurrentThemeSync());

  useEffect(() => {
    const dispose = workbenchThemeService.onThemeChange((newTheme) => {
      setCurrentTheme(newTheme);
      resetHighlighter(newTheme);
    });
    return () => dispose.dispose();
  }, []);

  const resetHighlighter = async (theme: ITheme) => {
    const highlighter = await createHighlighter({
      langs: [language],
      themes: [convertTheme(theme)],
      engine: createJavaScriptRegexEngine(),
    });

    await highlighter.loadTheme(convertTheme(theme));
    highlighterRef.current = highlighter;

    const newStream = new ReadableStream({
      start(controller) {
        controllerRef.current = controller;
        controller.enqueue(input);
        prevInputRef.current = input;
      },
    });

    const tokenStream = newStream.pipeThrough(
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

    setTokensStream(tokenStream);
  };

  useEffect(() => {
    resetHighlighter(currentTheme);
  }, [language]);

  useEffect(() => {
    if (!controllerRef.current || input === prevInputRef.current) {
      return;
    }

    const diff = input.slice(prevInputRef.current.length);
    if (diff) {
      controllerRef.current.enqueue(diff);
      prevInputRef.current = input;
    }

    return () => {
      if (controllerRef.current) {
        controllerRef.current.close();
      }
    };
  }, [input]);

  return <div>{tokensStream && <ShikiStreamRenderer stream={tokensStream} />}</div>;
});

function convertTheme(theme: ITheme): ThemeInput {
  return {
    name: theme.themeData.name,
    settings: theme.themeData.settings,
    tokenColors: theme.themeData.tokenColors || [],
  };
}
