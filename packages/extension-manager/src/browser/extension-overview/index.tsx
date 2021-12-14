import React from 'react';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';
import { Icon, getKaitianIcon, Button, Tabs } from '@opensumi/ide-components';
import { localize, replaceLocalizePlaceholder } from '@opensumi/ide-core-common';
import { Markdown } from '@opensumi/ide-markdown';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/components/progressbar';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';

import { VSXExtensionRaw } from '../../common/vsx-registry-types';
import * as styles from './overview.module.less';
import { InstallState, IVSXExtensionService, VSXExtension, VSXExtensionServiceToken } from '../../common';

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
  const [loading, setLoading] = React.useState(true);
  const [activateKey, setActivateKey] = React.useState(TabActiveKey.details);
  const [metadata, setMetadata] = React.useState<IExtensionMetadata>({});

  const onDidTabChange = React.useCallback((index: number) => {
    const activeKey = tabMap[index];
    if (activeKey) {
      setActivateKey(activeKey);
    }
  }, []);

  const getExtensonMetadata = React.useCallback(
    ({ readme, changelog }: { [prop: string]: string | undefined }) =>
      [
        readme && fetch(readme).then((res) => res.text()),
        changelog && fetch(changelog).then((res) => res.text()),
      ].filter(Boolean),
    [],
  );

  const initExtensionMetadata = React.useCallback(async () => {
    const extension = await vsxExtensionService.getRemoteRawExtension(resource.metadata!.extensionId);
    if (extension) {
      const tasks = getExtensonMetadata({ readme: extension.files.readme, changelog: extension.files.changelog });
      const [readme, changelog] = await Promise.all(tasks);
      setMetadata({ readme, changelog, downloadCount: extension.downloadCount });
    }
    setLoading(false);
  }, [resource]);

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
          <div className={styles.mainfest}>
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
                  Lisense
                </a>
              </span>
            )}
            <span>v{resource.metadata?.version}</span>
          </div>
          <div className={styles.description}>
            {replaceLocalizePlaceholder(resource.metadata?.description, resource.metadata?.extensionId)}
          </div>
          {resource.metadata?.state === InstallState.NOT_INSTALLED && (
            <div>
              <Button size='small' onClick={() => {}}>
                {localize('marketplace.extension.install')}
              </Button>
            </div>
          )}
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
