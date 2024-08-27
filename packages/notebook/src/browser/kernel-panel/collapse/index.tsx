import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import React, { useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { IDialogService, IMessageService } from '@opensumi/ide-overlay';

import {
  LibroPanelCollapseItem,
  LibroPanelCollapseItemType,
  LibroPanelCollapseKernelItem,
  Props,
} from '../kernel.panel.protocol';

import './index.less';
import { LibroKernelCollapseContent } from './kernel-collapse-content';
import { OpenedTabs } from './page-collapse-content';

const getCollapseContentView = (
  type: LibroPanelCollapseItemType,
  items: LibroPanelCollapseItem[] | undefined,
  refresh: () => void,
) => {
  if (!items) {
    return <div className='kernel-and-terminal-panel-empty'>暂无内容</div>;
  }

  switch (type) {
    case LibroPanelCollapseItemType.PAGE:
      return <OpenedTabs refresh={refresh} />;

    case LibroPanelCollapseItemType.KERNEL:
      return (
        <LibroKernelCollapseContent type={type} items={items as LibroPanelCollapseKernelItem[]} refresh={refresh} />
      );
  }
};

const getCollapseHeaderLabel = (type: LibroPanelCollapseItemType) => {
  switch (type) {
    case LibroPanelCollapseItemType.PAGE:
      return '已开启的标签页';
    case LibroPanelCollapseItemType.KERNEL:
      return '运行的内核';
  }
};

export const LibroCollapse: React.FC<Props> = (props: Props) => {
  const [open, setOpen] = useState<boolean>(true);

  const dialogService: IDialogService = useInjectable(IDialogService);
  const messageService: IMessageService = useInjectable(IMessageService);

  const confirmCloseAll = () => {
    dialogService.info('你确定要关闭全部吗？', ['确认', '取消']).then((val) => {
      if (val === '确认' && props.shutdownAll) {
        props
          .shutdownAll()
          .then(() => {
            props.refresh();
          })
          .catch(() => {
            messageService.error(`shutdown all ${props.type}s error`);
          });
      }
    });
  };

  return (
    <div className='libro-panel-collapse-container' key={props.type}>
      <div className='libro-panel-collapse-header'>
        <div
          className='libro-panel-collapse-header-left'
          onClick={() => {
            setOpen(!open);
          }}
        >
          <div className='libro-panel-collapse-header-icon'>
            {open ? <CaretDownOutlined /> : <CaretRightOutlined />}
          </div>
          <div className='libro-panel-collapse-header-label'>{getCollapseHeaderLabel(props.type)}</div>
        </div>
        <div className='libro-panel-collapse-header-close-all' onClick={confirmCloseAll}>
          关闭全部
        </div>
      </div>
      {open && (
        <div className='libro-panel-collapse-content'>
          {getCollapseContentView(props.type, props.items, props.refresh)}
        </div>
      )}
    </div>
  );
};
