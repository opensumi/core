import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser';
import { Collapse, Dropdown, Icon, Menu } from 'antd';
import { basename } from '@ali/ide-core-common/lib/path';

import { ISCMRepository, ISCMProvider } from '../../common';
import * as styles from './scm-select.module.less';

import 'antd/lib/collapse/style/index.less';

const SCMProvider: React.FC<{
  provider: ISCMProvider;
  selected?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}> = ({ provider, ...restProps }) => {
  const hasRootUri = provider.rootUri;
  const title = hasRootUri ? basename(provider.rootUri!.toString()) : provider.label;
  const type = hasRootUri ? provider.label : '';

  return (
    <div {...restProps}>
      {title}
      {type}
      {provider.count}
    </div>
  );
};

const openKey = '__openKey';

export const SCMRepoSelect: React.FC<{
  repositoryList: ISCMRepository[];
  selectedRepository?: ISCMRepository;
  // onRepositorySelect: (payload: ISCMRepository) => void;
}> = function SCMRepoSelect({ repositoryList, selectedRepository }) {
  const [ expanded, setExpanded ] = React.useState<boolean>(false);

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

  return (
    <div className={styles.scmSelect}>
      <Collapse
        accordion
        activeKey={expanded ? [openKey] : []}
        onChange={() => setExpanded((r) => !r)}>
        <Collapse.Panel
          key={openKey}
          header={<SCMProvider provider={selectedRepository.provider} />}>
          {
            repositoryList.map((repository) => (
              <SCMProvider
                key={repository.provider.id}
                selected={repository.provider.id === selectedRepository.provider.id}
                onClick={(e) => {
                  e.preventDefault();
                  handleRepositorySelect(repository);
                }}
                provider={repository.provider} />
            ))
          }
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};
