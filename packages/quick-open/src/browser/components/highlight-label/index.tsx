import React from 'react';

import { Highlight } from '@opensumi/ide-core-browser/lib/quick-open';
import { escape } from '@opensumi/ide-core-common';

export interface HighlightLabelProp {
  text?: string;
  highlights?: Highlight[];
  className?: string;
  labelClassName?: string;
  hightLightClassName?: string;
  OutElementType?: string;
}

export const HighlightLabel: React.FC<HighlightLabelProp> = ({
  text = '',
  highlights = [],
  className = '',
  labelClassName = '',
  hightLightClassName = '',
  OutElementType = 'span',
}) => {
  const renderLabel = React.useMemo(() => {
    const children: string[] = [];
    let pos = 0;

    for (const highlight of highlights) {
      if (highlight.end === highlight.start) {
        continue;
      }
      if (pos < highlight.start) {
        const substring = text.substring(pos, highlight.start);
        children.push(`<span class=${labelClassName}>${escape(substring)}</span>`);
        pos = highlight.end;
      }
      const substring = text.substring(highlight.start, highlight.end);
      children.push(`<span class=${hightLightClassName}>${escape(substring)}</span>`);
      pos = highlight.end;
    }

    if (pos < text.length) {
      const substring = text.substring(pos);
      children.push(`<span class=${labelClassName}>${escape(substring)}</span>`);
    }

    return children.join('');
  }, [text, highlights]);
  return (
    <OutElementType
      // @ts-ignore
      title={text}
      className={className}
      dangerouslySetInnerHTML={{ __html: renderLabel }}
    ></OutElementType>
  );
};
