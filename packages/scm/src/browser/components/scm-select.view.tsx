import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser';
import { ViewState } from '@ali/ide-activity-panel';
import { IStatusBarService } from '@ali/ide-status-bar';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import clx from 'classnames';
import Icon from '@ali/ide-core-browser/lib/components/icon';
import Badge from '@ali/ide-core-browser/lib/components/badge';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import StatusBarItem from '@ali/ide-status-bar/lib/browser/status-bar-item.view';

import { ISCMRepository, scmItemLineHeight, SCMMenuId } from '../../common';
import { getSCMRepositoryDesc } from '../scm-util';

import * as styles from './scm-select.module.less';

const SCMProvider: React.FC<{
  repository: ISCMRepository;
  selected?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  style: React.CSSProperties;
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
          statusConfig.map((config) => <StatusBarItem key={config.id} {...config} />)
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

  const contextMenuRenderer = useInjectable<ContextMenuRenderer>(ContextMenuRenderer);

  const handleRepositorySelect = React.useCallback((selectedRepo: ISCMRepository) => {
    selectedRepo.setSelected(true);
    selectedRepo.focus();
  }, []);

  const handleProviderCtxMenu = React.useCallback((selectedRepo: ISCMRepository, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = e.nativeEvent;

    contextMenuRenderer.render(
      [ SCMMenuId.SCM_SOURCE_CONTROL ],
      { x, y, ...selectedRepo.provider.toJSON() },
    );
  }, []);

  return (
    <div className={styles.scmSelect}>
      <AutoSizer>
        {
          ({ width, height }) => (
            <List
              className={styles.list}
              height={height}
              width={width}
              itemCount={repositoryList.length}
              itemData={repositoryList}
              itemSize={scmItemLineHeight}
            >
              {
                ({ data, index, style }) => {
                  const currentRepo = data[index];
                  return (
                    <SCMProvider
                      key={currentRepo.provider.id}
                      style={style}
                      selected={currentRepo.provider.id === selectedRepository.provider.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleRepositorySelect(currentRepo);
                      }}
                      onContextMenu={handleProviderCtxMenu.bind(null, currentRepo)}
                      repository={currentRepo} />
                  );
                }
              }
            </List>
          )
        }
      </AutoSizer>
    </div>
  );
};
