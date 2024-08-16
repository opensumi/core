import { CloseOutlined } from '@ant-design/icons';
import React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { IMessageService } from '@opensumi/ide-overlay';

import { LibroPanelCollapseItem, LibroPanelCollapseItemType } from '../kernel.panel.protocol';

import { OpenedPage, RunningKernel } from './icon';

export const getIcon = (type: LibroPanelCollapseItemType) => {
  switch (type) {
    case LibroPanelCollapseItemType.PAGE:
      return <OpenedPage></OpenedPage>;
    case LibroPanelCollapseItemType.KERNEL:
      return <RunningKernel></RunningKernel>;
  }
};

interface Props {
  type: LibroPanelCollapseItemType;
  items: LibroPanelCollapseItem[];
}

export const LibroCollapseContent: React.FC<Props> = (props: Props) => {
  const messageService: IMessageService = useInjectable(IMessageService);
  return (
    <>
      {props.items.map((item) => (
        <div className='libro-panel-collapse-item' key={item.id}>
          <div className='libro-panel-collapse-item-icon'>{getIcon(props.type)}</div>
          <div className='libro-panel-collapse-item-label'>{item.name}</div>
          <div
            className='libro-panel-collapse-item-close'
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (item.shutdown) {
                item.shutdown().catch((error) => {
                  messageService.error(`shutdown ${props.type} failed: ${error}`);
                });
              }
            }}
          >
            <CloseOutlined />
          </div>
        </div>
      ))}
    </>
  );
};
