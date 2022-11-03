import React from 'react';

import { getExternalIcon } from '@opensumi/ide-core-browser';

export namespace CSSIcon {
  export const iconNameSegment = '[A-Za-z0-9]+';
  export const iconNameExpression = '[A-Za-z0-9\\-]+';
  export const iconModifierExpression = '~[A-Za-z]+';
}

const labelWithIconsRegex = new RegExp(
  `(\\\\)?\\$\\((${CSSIcon.iconNameExpression}(?:${CSSIcon.iconModifierExpression})?)\\)`,
  'g',
);

export function renderLabelWithIcons(text: string): Array<React.ReactElement | string> {
  const elements = new Array<React.ReactElement | string>();
  let match: RegExpMatchArray | null;

  let textStart = 0;
  let textStop = 0;
  while ((match = labelWithIconsRegex.exec(text)) !== null) {
    textStop = match.index || 0;
    elements.push(text.substring(textStart, textStop));
    textStart = (match.index || 0) + match[0].length;

    const [, escaped, codicon] = match;
    elements.push(escaped ? `$(${codicon})` : <span className={getExternalIcon(codicon)}></span>);
  }

  if (textStart < text.length) {
    elements.push(text.substring(textStart));
  }
  return elements;
}
