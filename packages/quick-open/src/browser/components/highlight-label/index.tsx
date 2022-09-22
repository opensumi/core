import React from 'react';

import { getExternalIcon, LabelIcon, LabelPart, parseLabel } from '@opensumi/ide-core-browser';
import { Highlight } from '@opensumi/ide-core-browser/lib/quick-open';
import { strings } from '@opensumi/ide-core-common';

const { escape } = strings;

const labelWithIcons = (str: string) => parseLabel(escape(str)).reduce((pre: string | LabelPart, cur: LabelPart) => {
    if (!(typeof cur === 'string') && LabelIcon.is(cur)) {
      return pre + `<span class='${getExternalIcon(cur.name)}'></span>`;
    }
    return pre + cur;
  }, '');

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
        children.push(`<span class='${labelClassName}'>${labelWithIcons(substring)}</span>`);
        pos = highlight.end;
      }
      const substring = text.substring(highlight.start, highlight.end);
      children.push(`<span class='${hightLightClassName}'>${labelWithIcons(substring)}</span>`);
      pos = highlight.end;
    }

    if (pos < text.length) {
      const substring = text.substring(pos);
      children.push(`<span class='${labelClassName}'>${labelWithIcons(substring)}</span>`);
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
