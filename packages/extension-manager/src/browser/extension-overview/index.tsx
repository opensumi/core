import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { Button, Icon, Tabs, getIcon } from '@opensumi/ide-components';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { localize, replaceLocalizePlaceholder } from '@opensumi/ide-core-common';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';
import { Markdown } from '@opensumi/ide-markdown';

import { IVSXExtensionService, InstallState, VSXExtension, VSXExtensionServiceToken } from '../../common';
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

const enum ExtensionStatus {
  CAN_INSTALL,
  INSTALLING,
  UNINSTALLING,
  UNINSTALLED,
  INSTALLED,
  ENABLING,
}

export const ExtensionOverview: ReactEditorComponent<
  VSXExtensionRaw & VSXExtension & { state: string; extensionId: string; openVSXRegistry: string }
> = ({ resource }) => {
  const vsxExtensionService = useInjectable<IVSXExtensionService>(VSXExtensionServiceToken);
  const [loading, setLoading] = useState(true);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>(
    resource.metadata?.state === InstallState.INSTALLED ? ExtensionStatus.INSTALLED : ExtensionStatus.CAN_INSTALL,
  );
  const [activateKey, setActivateKey] = useState(TabActiveKey.details);
  const [metadata, setMetadata] = useState<IExtensionMetadata>({});

  const onDidTabChange = useCallback((index: number) => {
    const activeKey = tabMap[index];
    if (activeKey) {
      setActivateKey(activeKey);
    }
  }, []);

  const initExtensionMetadata = useCallback(async () => {
    const extension = await vsxExtensionService.getRemoteRawExtension(resource.metadata?.extensionId);

    if (extension) {
      const tasks = ['readme', 'changelog'].map((key) => {
        const file = extension.files?.[key];

        return file ? fetch(file).then((res) => res.text()) : extension[key] ?? '';
      });

      const [readme, changelog] = await Promise.all(tasks);
      setMetadata({ readme, changelog, downloadCount: extension.downloadCount });
    }
    setLoading(false);
  }, [resource]);

  const install = useCallback(async () => {
    const extension = await vsxExtensionService.getLocalExtension(resource.metadata?.extensionId);
    if (extension) {
      setExtensionStatus(ExtensionStatus.INSTALLING);
      vsxExtensionService.install(extension).finally(() => {
        setExtensionStatus(ExtensionStatus.INSTALLED);
      });
    }
  }, [resource]);

  const uninstall = useCallback(async () => {
    const extension = await vsxExtensionService.getLocalExtension(resource.metadata?.extensionId);
    if (extension) {
      setExtensionStatus(ExtensionStatus.UNINSTALLING);
      vsxExtensionService.uninstall(extension).finally(() => {
        setExtensionStatus(ExtensionStatus.UNINSTALLED);
      });
    }
  }, [resource]);

  useEffect(() => {
    initExtensionMetadata();
  }, [resource]);

  const operatorButtons = useMemo(() => {
    const buttons: ReactNode[] = [];
    if (resource.metadata?.state !== InstallState.NOT_INSTALLED) {
      if (extensionStatus !== ExtensionStatus.UNINSTALLED) {
        buttons.push(
          <Button
            size='small'
            key={'uninstall'}
            onClick={uninstall}
            disabled={extensionStatus === ExtensionStatus.UNINSTALLING}
          >
            {localize(
              extensionStatus === ExtensionStatus.UNINSTALLING
                ? 'marketplace.extension.uninstalling'
                : 'marketplace.extension.uninstall',
            )}
          </Button>,
        );
      } else {
        buttons.push(
          <Button size='small' key={'uninstalled'} disabled>
            {localize('marketplace.extension.uninstalled')}
          </Button>,
        );
        return buttons;
      }
    }
    if (resource.metadata?.state === InstallState.NOT_INSTALLED) {
      if (extensionStatus === ExtensionStatus.INSTALLED) {
        buttons.push(
          <Button size='small' key={'installed'} disabled>
            {localize('marketplace.extension.installed')}
          </Button>,
        );
      } else {
        buttons.push(
          <Button
            size='small'
            key={'install'}
            onClick={install}
            disabled={extensionStatus !== ExtensionStatus.CAN_INSTALL}
          >
            {localize(
              extensionStatus === ExtensionStatus.INSTALLING
                ? 'marketplace.extension.installing'
                : 'marketplace.extension.install',
            )}
          </Button>,
        );
      }
    } else if (resource.metadata?.state === InstallState.SHOULD_UPDATE) {
      if (extensionStatus === ExtensionStatus.INSTALLED) {
        buttons.push(
          <Button size='small' key={'installed'} disabled>
            {localize('marketplace.extension.installed')}
          </Button>,
        );
      } else {
        buttons.push(
          <Button
            size='small'
            key={'update'}
            onClick={install}
            disabled={extensionStatus !== ExtensionStatus.CAN_INSTALL}
          >
            {localize(
              extensionStatus === ExtensionStatus.INSTALLING
                ? 'marketplace.extension.updating'
                : 'marketplace.extension.update',
            )}
          </Button>,
        );
      }
    } else {
      buttons.push(
        <Button size='small' key={'installed'} disabled>
          {localize('marketplace.extension.installed')}
        </Button>,
      );
    }
    return buttons;
  }, [resource, extensionStatus]);

  return (
    <div className={styles.extension_overview_container}>
      <Progress loading={loading} />
      <div className={styles.extension_overview_header}>
        {resource.metadata?.iconUrl ? (
          <img
            src={resource.metadata?.iconUrl}
            alt={replaceLocalizePlaceholder(resource.metadata?.displayName, resource.metadata?.extensionId)}
          />
        ) : (
          <div className={styles.default_icon}>
            <Icon iconClass={getIcon('extension')} />
          </div>
        )}
        <div className={styles.extension_detail}>
          <div className={styles.extension_name}>
            <h1>
              <a
                href={`${
                  resource.metadata?.openVSXRegistry
                }/extension/${resource.metadata?.namespace.toLowerCase()}/${resource.metadata?.name.toLowerCase()}`}
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
              <Icon iconClass={getIcon('download')} />
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
          <div className={styles.buttons}>{operatorButtons}</div>
        </div>
      </div>
      <div className={styles.extension_overview_body}>
        <Tabs
          className={styles.tabs}
          value={activateKey}
          onChange={onDidTabChange}
          tabs={[TabActiveKey.details, TabActiveKey.changelog]}
        />
        <div className={styles.extension_content}>
          {activateKey === TabActiveKey.details && metadata.readme && <Markdown content={metadata.readme} />}
          {activateKey === TabActiveKey.changelog && metadata.changelog && <Markdown content={metadata.changelog} />}
        </div>
      </div>
    </div>
  );
};
