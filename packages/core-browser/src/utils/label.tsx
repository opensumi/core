import React, { CSSProperties } from 'react';

import { Icon } from '@opensumi/ide-components/lib/icon/icon';

const SEPERATOR = ' ';

export function transformLabelWithCodicon(
  label: string,
  iconStyles: CSSProperties = {},
  transformer?: (str: string) => string | undefined,
) {
  const ICON_REGX = /\$\(([a-z.]+\/)?([a-z-]+)(~[a-z]+)?\)/gi;
  const ICON_WITH_ANIMATE_REGX = /\$\(([a-z.]+\/)?([a-z-]+)~([a-z]+)\)/gi;
  return label.split(SEPERATOR).map((e, index) => {
    if (!transformer) {
      return e;
    }
    const icon = transformer(e);
    if (icon) {
      return <Icon className={icon} style={iconStyles} key={`${index}-${icon}`} />;
    } else if (ICON_REGX.test(e)) {
      if (e.includes('~')) {
        const [, , icon, animate] = ICON_WITH_ANIMATE_REGX.exec(e) || [];
        if (animate && icon) {
          return (
            <Icon className={transformer(`$(${icon})`)} style={iconStyles} animate={animate} key={`${index}-${icon}`} />
          );
        }
      }
      const newStr = e.replaceAll(ICON_REGX, (e) => `${SEPERATOR}${e}${SEPERATOR}`);
      return transformLabelWithCodicon(newStr, iconStyles, transformer);
    } else {
      return <span key={`${index}-${e}`}>{e}</span>;
    }
  });
}
