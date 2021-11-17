import * as React from 'react';
import { ReactEditorComponent } from '@ide-framework/ide-editor/lib/browser';
import { Icon, getKaitianIcon, Button, Tabs } from '@ide-framework/ide-components';
import { localize } from '@ide-framework/ide-core-common';

import { VSXExtensionRaw } from '../../common/vsx-registry-types';
import * as styles from './overview.module.less';
import { VSXExtension } from '../../common';

const tabMap = [
  'readme',
  'changelog',
];

export const ExtensionOverview: ReactEditorComponent<VSXExtensionRaw & VSXExtension> = ({ resource }) => {
  return (
    <div>
      <div className={styles.extension_overview_header}>
        <img src={resource.metadata?.files.icon || 'https://open-vsx.org/default-icon.png'} alt={resource.metadata?.displayName} />
        <div className={styles.extension_detail}>
          <div className={styles.extension_name}>
            <h1>
              <a
                href={`https://open-vsx.org/extension/${resource.metadata?.namespace.toLowerCase()}/${resource.metadata?.name.toLowerCase()}`}
                target='_blank'
                rel='noopener noreferrer'
              >
                {resource.metadata?.displayName || resource.metadata?.name}
              </a>
            </h1>
            <span className={styles.extension_id}>
              {resource.metadata?.namespace.toLowerCase() + '.' + resource.metadata?.name.toLowerCase()}
            </span>
          </div>
          <div className={styles.mainfest}>
            <span>
              <a href={resource.metadata?.namespaceUrl} target='_blank' rel='noopener noreferrer'>
                {resource.metadata?.namespace}
              </a>
            </span>
            <span>
              <Icon iconClass={getKaitianIcon('download')} />
              {resource.metadata?.downloadCount}
            </span>
            {resource.metadata?.averageRating && <span>{resource.metadata?.averageRating}</span>}
            {resource.metadata?.repository && (
              <span>
                <a href={resource.metadata?.repository} target='blank'>
                  Repository
                </a>
              </span>
            )}
            {resource.metadata?.license && (
              <span>
                <a href={resource.metadata?.files.license} target='blank'>
                  Lisense
                </a>
              </span>
            )}
            <span>v{resource.metadata?.version}</span>
          </div>
          <div className={styles.description}>{resource.metadata?.description}</div>
          <div>
            <Button size='small' onClick={() => { }}>
              {localize('marketplace.extension.install')}
            </Button>
          </div>
        </div>
      </div>
      <div className={styles.extension_overview_body}>
        <Tabs
          className={styles.tabs}
          value={'readme'}
          onChange={(index: number) => {
            const activeKey = tabMap[index];
            if (activeKey) {
              // setActiveKey(activeKey);
            }
          }}
          tabs={['Details', 'Changelog', 'Dependencies']}
        />
      </div>
    </div>
  );
};
