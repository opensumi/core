import React from 'react';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';
import { Icon, getKaitianIcon, Button, Tabs } from '@opensumi/ide-components';
import { localize } from '@opensumi/ide-core-common';
import { Markdown } from '@opensumi/ide-markdown';

import { VSXExtensionRaw } from '../../common/vsx-registry-types';
import * as styles from './overview.module.less';
import { VSXExtension } from '../../common';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/components/progressbar';

enum TabActiveKey {
  details = 'Details',
  changelog = 'ChangeLog',
  deps = 'Dependencies',
}

const tabMap = [
  TabActiveKey.details,
  TabActiveKey.changelog,
  TabActiveKey.deps,
];

interface IExtensionMetadata {
  readme?: string;
  changelog?: string;
}

export const ExtensionOverview: ReactEditorComponent<VSXExtensionRaw & VSXExtension> = ({ resource }) => {
  const files = React.useMemo(() => {
    return resource.metadata?.files;
  }, [resource]);
  const [loading, setLoading] = React.useState(true);
  const [activateKey, setActivateKey] = React.useState(TabActiveKey.details);
  const [metadata, setMetadata] = React.useState<IExtensionMetadata>({});
  const tabs: TabActiveKey[] = React.useMemo(() => {
    const res: TabActiveKey[] = [];
    if (resource.metadata?.files.readme) {
      res.push(TabActiveKey.details);
    }
    if (resource.metadata?.files.changelog) {
      res.push(TabActiveKey.changelog);
    }
    return res;
  }, [resource]);

  const onDidTabChange = React.useCallback((index: number) => {
    const activeKey = tabMap[index];
    if (activeKey) {
      setActivateKey(activeKey);
    }
  }, []);

  const initExtensionMetadata = React.useCallback(async () => {
    const tasks = [
      files?.readme && fetch(files.readme).then((res) => res.text()),
      files?.changelog && fetch(files.changelog).then((res) => res.text()),
    ];
    const [readme, changelog] = await Promise.all(tasks);
    setMetadata({ readme, changelog });
    setLoading(false);
  }, [files]);

  React.useEffect(() => {
    initExtensionMetadata();
  }, [files]);

  return (
    <div className={styles.extension_overview_container}>
      <ProgressBar loading={loading} />
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
          value={activateKey}
          onChange={onDidTabChange}
          tabs={tabs}
        />
        {activateKey === TabActiveKey.details && metadata.readme && (<Markdown content={metadata.readme} />)}
        {activateKey === TabActiveKey.changelog && metadata.changelog && (<Markdown content={metadata.changelog} />)}
      </div>
    </div>
  );
};
