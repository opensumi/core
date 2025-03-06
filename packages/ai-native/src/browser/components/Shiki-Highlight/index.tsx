import React, { memo, useEffect, useRef, useState } from 'react';
import { createHighlighter, createJavaScriptRegexEngine } from 'shiki';
import { CodeToTokenTransformStream } from 'shiki-stream';
import { ShikiStreamRenderer } from 'shiki-stream/react';

export interface ShikeHighlightProps {
  input: string;
  relationId: string;
  language?: string;
  agentId?: string;
  command?: string;
  hideInsert?: boolean;
}

export const ShikiHighlight = memo(({ input, language }: ShikeHighlightProps) => {
  const streamRef = useRef<ReadableStream | null>(null);
  const [tokensStream, setTokensStream] = useState<ReadableStream | null>(null);
  const controllerRef = useRef<ReadableStreamDefaultController | null>(null);

  useEffect(() => {
    if (!streamRef.current) {
      streamRef.current = new ReadableStream({
        start(controller) {
          controllerRef.current = controller;
        },
      });
    }

    return () => {
      if (controllerRef.current) {
        try {
          controllerRef.current?.close();
        } catch {}
      }
    };
  }, []);

  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.enqueue(input);
    }
  }, [input]);

  useEffect(() => {
    if (streamRef.current && !tokensStream) {
      createHighlighter({
        langs: [language!],
        themes: [],
        engine: createJavaScriptRegexEngine(),
      }).then(async(highlighter) => {
        await highlighter.loadTheme('min-dark');
        const tokenStream = streamRef.current!.pipeThrough(
          new CodeToTokenTransformStream({
            highlighter,
            lang: language,
            themes: {
              light: 'min-dark',
              dark: 'min-dark',
            },
            allowRecalls: true,
          }),
        );
        setTokensStream(tokenStream);
      });
    }
  }, [streamRef, tokensStream]);

  return (
    <div>
      {tokensStream && <ShikiStreamRenderer stream={tokensStream} />}
    </div>
  );
});
