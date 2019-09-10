import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser';
import { basename } from '@ali/ide-core-common/lib/path';
import { ViewState } from '@ali/ide-activity-panel';
import { IStatusBarService } from '@ali/ide-status-bar';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import clx from 'classnames';
import Icon from '@ali/ide-core-browser/lib/components/icon';
import Badge from '@ali/ide-core-browser/lib/components/badge';

import { ISCMRepository, ISCMProvider, scmItemLineHeight } from '../../common';

import * as styles from './scm-select.module.less';
import { getSCMRepositoryDesc } from '../scm-util';

const SCMProvider: React.FC<{
  repository: ISCMRepository;
  selected?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
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

  console.log(statusConfig, 'commands');

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
            <div className={styles.action} id={config.id} title={config.tooltip}>
              <Icon iconset={config.iconset} name={config.icon} />
              &nbsp;
              <span>{config.text}</span>
            </div>
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
  // onRepositorySelect: (payload: ISCMRepository) => void;
}> = function SCMRepoSelect({ repositoryList, selectedRepository, viewState }) {
  if (!selectedRepository) {
    return null;
  }

  const handleRepositorySelect = React.useCallback((selectedRepo: ISCMRepository) => {
    // repositoryList.forEach((repository) => {
    //   repository.setSelected(repository === selectedRepo);
    // });
    selectedRepo.setSelected(true);
    selectedRepo.focus();
  }, []);
  console.log(viewState, 'xxxx');
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
