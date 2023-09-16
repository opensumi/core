import React, { useCallback, useMemo } from 'react';

import { getExternalIcon, getIcon } from '@opensumi/ide-core-browser';
import { Icon } from '@opensumi/ide-core-browser/lib/components/index';

export const AIImprove = (props: { onClick?: (title: string) => void; lists?: { title: string; iconClass: string }[] }) => {
  const { onClick, lists } = props;

  const handleClick = useCallback(
    (title) => {
      if (onClick) {
        onClick(title);
      }
    },
    [onClick],
  );

  const useLists = useMemo(() => {
    if (lists && lists.length > 0) {
      return lists;
    }
    return [
      { title: '采纳', iconClass: getExternalIcon('git-pull-request') },
      { title: '|', iconClass: ''},
      { title: '丢弃', iconClass:  getExternalIcon('clear-all')},
      { title: '|', iconClass: ''},
      { title: '优化', iconClass: getExternalIcon('wand')},
      { title: '|', iconClass: ''},
      { title: '更多指令', iconClass: getIcon('more')},
    ];
  }, [lists]);

  return (
    <ul style={{ display: 'flex', alignItems: 'center', paddingLeft: '0', margin: '6px 0 6px 0' }}>
      {useLists.map(({ title, iconClass }) => (
        <li style={{ marginRight: '6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          {iconClass && <Icon className={iconClass} style={{marginRight: '6px'}}></Icon>}
          <span onClick={() => handleClick(title)}>
            {title}
          </span>
        </li>
      ))}
    </ul>
  );
};
