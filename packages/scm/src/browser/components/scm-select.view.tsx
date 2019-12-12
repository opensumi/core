import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser';
import { ViewState } from '@ali/ide-core-browser';
import { IStatusBarService } from '@ali/ide-status-bar';
import clx from 'classnames';
import Badge from '@ali/ide-core-browser/lib/components/badge';
import { StatusBarItem } from '@ali/ide-status-bar/lib/browser/status-bar-item.view';
import { AbstractMenuService, ICtxMenuRenderer, generateMergedCtxMenu, MenuId } from '@ali/ide-core-browser/lib/menu/next';

import { ISCMRepository } from '../../common';
import { getSCMRepositoryDesc } from '../scm-util';

import * as styles from './scm-select.module.less';

const SCMProvider: React.FC<{
  repository: ISCMRepository;
  selected?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  style?: React.CSSProperties;
}> = ({ repository, selected, ...restProps }) => {
  const { provider } = repository;
  const { title, type } = getSCMRepositoryDesc(repository);

  const statusBarService = useInjectable(IStatusBarService);

  const statusConfig = (provider.statusBarCommands || [])
    .map((c, index) => {
      return statusBarService.getElementConfig(`scm.repo.${index}`, {
        text: c.title,
        command: c.id,
        arguments: c.arguments,
        tooltip: c.tooltip,
        iconset: 'octicon',
      });
    });

  return (
    <div className={clx(styles.provider, { [styles.selected]: selected })} {...restProps}>
      <div className={styles.info}>
        <div className={styles.title}>{title}&nbsp;</div>
        <div className={styles.type}>{type}&nbsp;</div>
        {
          provider.count && provider.count > 0
            ? <Badge>{provider.count}</Badge>
            : null
        }
      </div>
      <div className={styles.toolbar}>
        {
          statusConfig.map((config) => (
            <StatusBarItem
              key={config.id}
              className={styles.status}
              {...config} />
          ))
        }
      </div>
    </div>
  );
};

export const SCMRepoSelect: React.FC<{
  repositoryList: ISCMRepository[];
  selectedRepository?: ISCMRepository;
  viewState: ViewState;
}> = function SCMRepoSelect({ repositoryList, selectedRepository, viewState }) {
  if (!selectedRepository) {
    return null;
  }

  const ctxMenuRenderer = useInjectable<ICtxMenuRenderer>(ICtxMenuRenderer);
  const menuService = useInjectable<AbstractMenuService>(AbstractMenuService);

  const handleRepositorySelect = React.useCallback((selectedRepo: ISCMRepository) => {
    selectedRepo.setSelected(true);
    selectedRepo.focus();
  }, []);

  const handleProviderCtxMenu = React.useCallback((selectedRepo: ISCMRepository, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = e.nativeEvent;

    const menus = menuService.createMenu(MenuId.SCMSourceControl);

    const menuNodes = generateMergedCtxMenu({
      menus,
      options: { args: [ selectedRepo.provider.toJSON() ] },
    });

    menus.dispose();

    ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
    });
  }, []);

  return (
    <div className={styles.scmSelect}>
      {
        repositoryList.map((currentRepo) => {
          return (
            <SCMProvider
              key={currentRepo.provider.id}
              selected={currentRepo.provider.id === selectedRepository.provider.id}
              onClick={handleRepositorySelect.bind(null, currentRepo)}
              onContextMenu={handleProviderCtxMenu.bind(null, currentRepo)}
              repository={currentRepo} />
          );
        })
      }
    </div>
  );
};
