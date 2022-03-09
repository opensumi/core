import React, { useCallback, useState } from 'react';

import { Icon, getKaitianIcon, Button, Tabs } from '@opensumi/ide-components';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/components/progressbar';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { localize, replaceLocalizePlaceholder } from '@opensumi/ide-core-common';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';
import { Markdown } from '@opensumi/ide-markdown';

import { InstallState, IVSXExtensionService, VSXExtension, VSXExtensionServiceToken } from '../../common';
import { VSXExtensionRaw } from '../../common/vsx-registry-types';

import styles from './overview.module.less';

enum TabActiveKey {
  details = 'Details',
  changelog = 'ChangeLog',
  deps = 'Dependencies',
}

const tabMap = [TabActiveKey.details, TabActiveKey.changelog, TabActiveKey.deps];

interface IExtensionMetadata {
  readme?: string;
  changelog?: string;
  icon?: string;
  downloadCount?: number;
  installed?: boolean;
}

export const ExtensionOverview: ReactEditorComponent<
  VSXExtensionRaw & VSXExtension & { state: string; extensionId: string }
> = ({ resource }) => {
  const vsxExtensionService = useInjectable<IVSXExtensionService>(VSXExtensionServiceToken);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<boolean>(false);
  const [activateKey, setActivateKey] = useState(TabActiveKey.details);
  const [metadata, setMetadata] = useState<IExtensionMetadata>({});

  const onDidTabChange = useCallback((index: number) => {
    const activeKey = tabMap[index];
    if (activeKey) {
      setActivateKey(activeKey);
    }
  }, []);

  const getExtensionMetadata = useCallback(
    ({ readme, changelog }: { [prop: string]: string | undefined }) =>
      [
        readme && fetch(readme).then((res) => res.text()),
        changelog && fetch(changelog).then((res) => res.text()),
      ].filter(Boolean),
    [],
  );

  const initExtensionMetadata = useCallback(async () => {
    const extension = await vsxExtensionService.getRemoteRawExtension(resource.metadata!.extensionId);
    if (extension) {
      const tasks = getExtensionMetadata({ readme: extension.files.readme, changelog: extension.files.changelog });
      const [readme, changelog] = await Promise.all(tasks);
      setMetadata({ readme, changelog, downloadCount: extension.downloadCount });
    }
    setLoading(false);
  }, [resource]);

  const onInstallCallback = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const extension = await vsxExtensionService.getLocalExtension(resource.metadata!.extensionId);
      if (extension) {
        setInstalling(true);
        vsxExtensionService.install(extension).finally(() => {
          setInstalling(false);
        });
      }
    },
    [resource],
  );

  React.useEffect(() => {
    initExtensionMetadata();
  }, [resource]);

  return (
    <div className={styles.extension_overview_container}>
      <ProgressBar loading={loading} />
      <div className={styles.extension_overview_header}>
        <img
          src={resource.metadata?.iconUrl || 'https://open-vsx.org/default-icon.png'}
          alt={replaceLocalizePlaceholder(resource.metadata?.displayName, resource.metadata?.extensionId)}
        />
        <div className={styles.extension_detail}>
          <div className={styles.extension_name}>
            <h1>
              <a
                href={`https://open-vsx.org/extension/${resource.metadata?.namespace.toLowerCase()}/${resource.metadata?.name.toLowerCase()}`}
                target='_blank'
                rel='noopener noreferrer'
              >
                {replaceLocalizePlaceholder(resource.metadata?.displayName, resource.metadata?.extensionId) ||
                  resource.metadata?.name}
              </a>
            </h1>
            <span className={styles.extension_id}>
              {resource.metadata?.namespace.toLowerCase() + '.' + resource.metadata?.name.toLowerCase()}
            </span>
          </div>
          <div className={styles.manifest}>
            <span>
              <a href={resource.metadata?.namespaceUrl} target='_blank' rel='noopener noreferrer'>
                {resource.metadata?.namespace}
              </a>
            </span>
            <span>
              <Icon iconClass={getKaitianIcon('download')} />
              {resource.metadata?.downloadCount || metadata.downloadCount}
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
                  License
                </a>
              </span>
            )}
            <span>v{resource.metadata?.version}</span>
          </div>
          <div className={styles.description}>
            {replaceLocalizePlaceholder(resource.metadata?.description, resource.metadata?.extensionId)}
          </div>
          <div>
            {resource.metadata?.state === InstallState.NOT_INSTALLED && (
              <Button size='small' onClick={onInstallCallback} disabled={installing}>
                {localize(installing ? 'marketplace.extension.installing' : 'marketplace.extension.install')}
              </Button>
            )}
            {resource.metadata?.state === InstallState.INSTALLED && (
              <span>{localize('marketplace.extension.installed')}</span>
            )}
          </div>
        </div>
      </div>
      <div className={styles.extension_overview_body}>
        <Tabs
          className={styles.tabs}
          value={activateKey}
          onChange={onDidTabChange}
          tabs={[TabActiveKey.details, TabActiveKey.changelog]}
        />
        {activateKey === TabActiveKey.details && metadata.readme && <Markdown content={metadata.readme} />}
        {activateKey === TabActiveKey.changelog && metadata.changelog && <Markdown content={metadata.changelog} />}
      </div>
    </div>
  );
};
