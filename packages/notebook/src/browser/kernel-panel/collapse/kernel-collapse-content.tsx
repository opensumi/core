import React from 'react';

import { LibroPanelCollapseItemType, LibroPanelCollapseKernelItem } from '../kernel.panel.protocol';

import { LibroKernelCollapseContentItem } from './kernel-collapse-content-item';

interface Props {
  type: LibroPanelCollapseItemType;
  items: LibroPanelCollapseKernelItem[];
  refresh: () => void;
}

export const LibroKernelCollapseContent: React.FC<Props> = (props: Props) => (
    <>
      {props.items.map((item) => <LibroKernelCollapseContentItem item={item} key={item.id} refresh={props.refresh} />)}
    </>
  );
