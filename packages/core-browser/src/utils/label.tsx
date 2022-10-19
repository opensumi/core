import React, { CSSProperties } from 'react';

import { Icon } from '@opensumi/ide-components/lib/icon/icon';

const SEPERATOR = ' ';

export function transformLabelWithCodicon(
  label: string,
  iconStyles: CSSProperties = {},
  transformer?: (str: string) => string | undefined,
) {
  const ICON_REGX = /^\$\(([a-z.]+\/)?([a-z-]+)(~[a-z]+)?\)$/i;
  return label.split(SEPERATOR).map((e) => {
    let icon: string | undefined;
    if (transformer) {
      icon = transformer(e);
    }
    if (icon && transformer) {
      return <Icon className={icon} style={iconStyles} />;
    } else if (ICON_REGX.test(e)) {
      const newStr = e.replaceAll(/^\$\(([a-z.]+\/)?([a-z-]+)(~[a-z]+)?\)$/i, (e) => `${SEPERATOR}${e}${SEPERATOR}`);
      return transformLabelWithCodicon(newStr, iconStyles, transformer);
    } else {
      return <span>{e}</span>;
    }
  });
}
