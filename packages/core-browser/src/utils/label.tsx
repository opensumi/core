import cls from 'classnames';
import React, { CSSProperties } from 'react';

import { Icon } from '@opensumi/ide-components/lib/icon/icon';
import { isFunction } from '@opensumi/ide-core-common';

const SEPERATOR = ' ';

export function transformLabelWithCodicon(
  label: string,
  iconStyleProps: CSSProperties | string = {},
  transformer?: (str: string) => string | undefined,
  renderText?: (str: string, index: number) => React.ReactNode,
) {
  const ICON_REGX = /\$\(([a-z.]+\/)?([a-z-]+)(~[a-z]+)?\)/gi;
  const ICON_WITH_ANIMATE_REGX = /\$\(([a-z.]+\/)?([a-z-]+)~([a-z]+)\)/gi;
  // some string like $() $(~spin)
  const ICON_ERROR_REGX = /\$\(([a-z.]+\/)?([a-z-]+)?(~[a-z]+)?\)/gi;

  const generateIconStyle = (icon?: string, styleProps?: CSSProperties | string) =>
    typeof styleProps === 'string' ? { className: cls(icon, styleProps) } : { className: icon, style: styleProps };

  const splitLabel = label.split(SEPERATOR);
  const length = splitLabel.length;

  return splitLabel.map((e, index) => {
    if (!transformer) {
      return e;
    }
    const icon = transformer(e);
    if (icon) {
      return <Icon {...generateIconStyle(icon, iconStyleProps)} key={`${index}-${icon}`} />;
    } else if (ICON_REGX.test(e)) {
      if (e.includes('~')) {
        const [, , icon, animate] = ICON_WITH_ANIMATE_REGX.exec(e) || [];
        if (animate && icon) {
          return (
            <Icon
              {...generateIconStyle(transformer(`$(${icon})`), iconStyleProps)}
              animate={animate}
              key={`${index}-${icon}`}
            />
          );
        }
      }
      const newStr = e.replaceAll(ICON_REGX, (e) => `${SEPERATOR}${e}${SEPERATOR}`);
      return transformLabelWithCodicon(newStr, iconStyleProps, transformer);
    } else if (ICON_ERROR_REGX.test(e)) {
      return transformLabelWithCodicon(e.replaceAll(ICON_ERROR_REGX, ''), iconStyleProps, transformer, renderText);
    } else {
      const withSeperator = e + (index === length - 1 ? '' : SEPERATOR);
      return isFunction(renderText) ? (
        renderText(withSeperator, index)
      ) : (
        <span key={`${index}-${e}`}>{withSeperator}</span>
      );
    }
  });
}

export function transformLabelWithCodiconHtml(
  label: string,
  transformer?: (str: string) => string | undefined,
): string {
  const ICON_REGX = /\$\(([a-z.]+\/)?([a-z-]+)(~[a-z]+)?\)/gi;
  const ICON_WITH_ANIMATE_REGX = /\$\(([a-z.]+\/)?([a-z-]+)~([a-z]+)\)/gi;
  // some string like $() $(~spin)
  const ICON_ERROR_REGX = /\$\(([a-z.]+\/)?([a-z-]+)?(~[a-z]+)?\)/gi;

  const splitLabel = label.split(SEPERATOR);
  const length = splitLabel.length;

  return splitLabel
    .map((e, index) => {
      if (!transformer) {
        return e;
      }
      const icon = transformer(e);
      if (icon) {
        return `<span class="kt-icon ${icon}" style="font-size: 14px;" ></span>`;
      } else if (ICON_REGX.test(e)) {
        if (e.includes('~')) {
          const [, , icon, animate] = ICON_WITH_ANIMATE_REGX.exec(e) || [];
          if (animate && icon) {
            return `<span class="kt-icon ${icon} codicon-animation-${animate}" style="font-size: 14px;" ></span>`;
          }
        }
        const newStr = e.replaceAll(ICON_REGX, (e) => `${SEPERATOR}${e}${SEPERATOR}`);
        return transformLabelWithCodiconHtml(newStr, transformer);
      } else if (ICON_ERROR_REGX.test(e)) {
        return transformLabelWithCodiconHtml(e.replaceAll(ICON_ERROR_REGX, ''), transformer);
      } else {
        const withSeperator = e + (index === length - 1 ? '' : SEPERATOR);
        return withSeperator;
      }
    })
    .join(SEPERATOR);
}
