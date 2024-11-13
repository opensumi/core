import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import { ConfigProvider, Empty, Popconfirm, message, theme } from 'antd';
import React, { useEffect, useState } from 'react';

import { localize, useInjectable } from '@opensumi/ide-core-browser';
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
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={localize('notebook.kernel.panel.empty')}
        className='kernel-and-terminal-panel-empty'
      />
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
      return localize('notebook.kernel.panel.opened.pages');
    case LibroPanelCollapseItemType.KERNEL:
      return localize('notebook.kernel.panel.running.kernels');
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
    const disposable = themeService.onThemeChange((e) => {
      setThemeType(e.type);
    });
    return () => {
      disposable.dispose();
    };
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
              title={localize('notebook.kernel.close.all.confirmation')}
              okText={localize('ButtonOK')}
              cancelText={localize('ButtonCancel')}
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
              {localize('editor.closeAllInGroup')}
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
