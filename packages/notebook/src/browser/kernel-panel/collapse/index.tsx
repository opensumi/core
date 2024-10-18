import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import { ConfigProvider, Empty, Popconfirm, message, theme } from 'antd';
import React, { useEffect, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { IThemeService } from '@opensumi/ide-theme/lib/common';

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
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='暂无内容' className='kernel-and-terminal-panel-empty' />
    );
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
  const themeService = useInjectable<IThemeService>(IThemeService);
  const [themeType, setThemeType] = useState('dark');
  useEffect(() => {
    themeService.getCurrentTheme().then((theme) => {
      setThemeType(theme.type);
    });
    themeService.onThemeChange((e) => {
      setThemeType(e.type);
    });
  }, []);
  return (
    <ConfigProvider
      theme={{
        algorithm: themeType === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
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
          <div className='libro-panel-collapse-header-close-all'>
            <Popconfirm
              title='你确定要关闭全部吗？'
              okText='确定'
              cancelText='取消'
              onConfirm={() => {
                if (props.shutdownAll) {
                  props
                    .shutdownAll()
                    .then(() => {
                      props.refresh();
                    })
                    .catch((e) => {
                      message.error(`shutdown all ${props.type}s error`);
                    });
                }
              }}
            >
              关闭全部
            </Popconfirm>
          </div>
        </div>
        {open && (
          <div className='libro-panel-collapse-content'>
            {getCollapseContentView(props.type, props.items, props.refresh)}
          </div>
        )}
      </div>
    </ConfigProvider>
  );
};
