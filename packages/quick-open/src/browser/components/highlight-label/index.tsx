import React, { ReactChild } from 'react';

import { transformLabelWithCodicon } from '@opensumi/ide-core-browser';
import { Highlight } from '@opensumi/ide-core-browser/lib/quick-open';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks';
import { IIconService } from '@opensumi/ide-theme';

export interface HighlightLabelProp {
  text?: string;
  highlights?: Highlight[];
  className?: string;
  labelClassName?: string;
  labelIconClassName?: string;
  hightLightClassName?: string;
  OutElementType?: string;
}

export const HighlightLabel: React.FC<HighlightLabelProp> = ({
  text = '',
  highlights = [],
  className = '',
  labelClassName = '',
  labelIconClassName = '',
  hightLightClassName = '',
  OutElementType = 'span',
}) => {
  const iconService = useInjectable<IIconService>(IIconService);

  const renderLabel = React.useMemo(() => {
    const children: ReactChild[] = [];
    let pos = 0;

    for (const highlight of highlights) {
      if (highlight.end === highlight.start) {
        continue;
      }
      if (pos < highlight.start) {
        const substring = text.substring(pos, highlight.start);
        children.push(
          <span className={labelClassName} key={`${children.length}-${substring}`}>
            {transformLabelWithCodicon(substring, labelIconClassName, iconService.fromString.bind(iconService))}
          </span>,
        );
        pos = highlight.end;
      }
      const substring = text.substring(highlight.start, highlight.end);
      children.push(
        <span className={hightLightClassName} key={`${children.length}-${substring}`}>
          {transformLabelWithCodicon(substring, labelIconClassName, iconService.fromString.bind(iconService))}
        </span>,
      );
      pos = highlight.end;
    }

    if (pos < text.length) {
      const substring = text.substring(pos);
      children.push(
        <span className={labelClassName} key={`${children.length}-${substring}`}>
          {transformLabelWithCodicon(substring, labelIconClassName, iconService.fromString.bind(iconService))}
        </span>,
      );
    }
    return children;
  }, [text, highlights]);
  return (
    // @ts-ignore
    <OutElementType title={text} className={className}>
      {renderLabel}
    </OutElementType>
  );
};
