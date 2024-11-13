import { LibroKernelManager, LibroSessionManager } from '@difizen/libro-kernel';
import { Container } from '@difizen/mana-app';
import { useEffect, useState } from 'react';
import React from 'react';

import { localize, useInjectable } from '@opensumi/ide-core-browser';
import { IThemeService } from '@opensumi/ide-theme/lib/common';

import { ManaContainer } from '../mana';

import { LibroCollapse } from './collapse';
import './index.less';
import { LibroPanelCollapseItemType, LibroPanelCollapseKernelItem } from './kernel.panel.protocol';

export const KernelPanel: React.FC = () => {
  const manaContainer = useInjectable<Container>(ManaContainer);

  const libroKernelManager = manaContainer.get(LibroKernelManager);

  const libroSessionManager = manaContainer.get(LibroSessionManager);

  const [refresh, setRefresh] = useState(new Date().toUTCString());

  const themeService = useInjectable<IThemeService>(IThemeService);

  const [theme, setTheme] = useState<string>('dark');

  const [kernelItems, setKernelItems] = useState<LibroPanelCollapseKernelItem[] | undefined>();

  const handleRefresh = () => {
    setRefresh(new Date().toUTCString());
  };

  useEffect(() => {
    themeService.getCurrentTheme().then((curTheme) => {
      setTheme(curTheme.type);
    });
    themeService.onThemeChange((curTheme) => {
      setTheme(curTheme.type);
    });
  }, []);

  useEffect(() => {
    if (!libroSessionManager.running || (libroSessionManager.running && libroSessionManager.running.size === 0)) {
      setKernelItems(undefined);
      return;
    }

    // kernelId -> item
    const items = new Map<string, LibroPanelCollapseKernelItem>();

    const runningSessions = libroSessionManager.running.values();

    for (const session of runningSessions) {
      const kernel = session.kernel!;
      if (items.has(kernel.id)) {
        items.get(kernel.id)?.notebooks.push({
          sessionId: session.id,
          name: session.name,
          path: session.path,
        });
      } else {
        items.set(kernel.id, {
          id: kernel.id,
          name: kernel.name,
          shutdown: async () => {
            await libroKernelManager.shutdown(kernel.id);
            await libroSessionManager.refreshRunning();
          },
          notebooks: [{ sessionId: session.id, name: session.name, path: session.path }],
        });
      }
    }

    setKernelItems(Array.from(items.values()));
  }, [libroKernelManager, libroSessionManager.running]);

  return (
    <div className='kernel-and-panel' key={refresh}>
      <div className='kernel-and-panel-header'>
        <div className='kernel-and-panel-title'>{localize('notebook.kernel.panel.title')}</div>
        <img
          width={16}
          height={16}
          src={
            theme === 'dark'
              ? 'https://mdn.alipayobjects.com/huamei_xt20ge/afts/img/A*rY0oTpYcmZsAAAAAAAAAAAAADiuUAQ/original'
              : 'https://mdn.alipayobjects.com/huamei_xt20ge/afts/img/A*VApRSqHz8wQAAAAAAAAAAAAADiuUAQ/original'
          }
          onClick={handleRefresh}
        ></img>
      </div>
      <LibroCollapse
        type={LibroPanelCollapseItemType.KERNEL}
        refresh={handleRefresh}
        items={kernelItems}
        shutdownAll={async () => {
          await libroKernelManager.shutdownAll();
          await libroSessionManager.refreshRunning();
        }}
      />
    </div>
  );
};
