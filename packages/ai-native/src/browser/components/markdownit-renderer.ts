import { fromAsyncCodeToHtml } from '@shikijs/markdown-it/async';
import MarkdownItAsync from 'markdown-it-async';
import { codeToHtml } from 'shiki';

import { ITheme } from '@opensumi/ide-theme';

export async function createMarkdownRenderer(theme: ITheme) {
  // Initialize MarkdownIt instance with markdown-it-async
  const md = MarkdownItAsync();

  md.use(
    fromAsyncCodeToHtml(
      codeToHtml,
      {
        theme: convertTheme(theme),
      },
    ),
  );

  return md;
}

function convertTheme(theme: ITheme) {
  return {
    name: theme.themeData.name,
    settings: theme.themeData.settings,
    tokenColors: theme.themeData.tokenColors || [],
  };
}
