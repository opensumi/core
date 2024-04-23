import React, { useCallback, useState } from 'react';

import { Button, Icon, getIcon } from '@opensumi/ide-components';
import { useDesignStyles } from '@opensumi/ide-core-browser';
import { localize, replaceLocalizePlaceholder } from '@opensumi/ide-core-common';

import { InstallState, VSXExtension } from '../../common';

import styles from './extension.module.less';

export enum ExtensionViewType {
  MARKETPLACE,
  INSTALLED,
}

interface IExtensionViewProps {
  extension: VSXExtension;
  onInstall(extension: VSXExtension): Promise<void>;
  onClick(extension: VSXExtension, state: InstallState): void;
  type: ExtensionViewType;
  installedExtensions?: VSXExtension[];
  openVSXRegistry: string;
}

export const Extension = React.memo(
  ({ extension: extension, onInstall, onClick, type, installedExtensions, openVSXRegistry }: IExtensionViewProps) => {
    const styles_extension_item = useDesignStyles(styles.extension_item, 'extension_item');
    const [installing, setInstalling] = useState<boolean>();
    const installedExtension = installedExtensions?.find(
      (installed) => installed.namespace === extension.namespace && installed.name === extension.name,
    );
    const isInstalled = Boolean(type === ExtensionViewType.INSTALLED || installedExtension);
    const shouldUpdate =
      isInstalled && type === ExtensionViewType.MARKETPLACE && installedExtension?.version !== extension.version;
    const [installedState, setInstalled] = useState<boolean>(isInstalled);

    const onInstallCallback = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setInstalling(true);
        onInstall(extension).then(() => {
          setInstalling(false);
          setInstalled(true);
        });
      },
      [extension],
    );

    const onClickCallback = useCallback(() => {
      onClick(
        extension,
        installedState
          ? shouldUpdate
            ? InstallState.SHOULD_UPDATE
            : InstallState.INSTALLED
          : InstallState.NOT_INSTALLED,
      );
    }, [extension]);

    return (
      <div className={styles_extension_item} onClick={onClickCallback}>
        {extension.iconUrl ? (
          <img
            className={styles.icon}
            src={extension.iconUrl}
            alt={replaceLocalizePlaceholder(extension.displayName, `${extension.publisher}.${extension.name}`)}
          />
        ) : (
          <div className={styles.default_icon}>
            <Icon iconClass={getIcon('extension')} />
          </div>
        )}
        <div className={styles.extension_detail}>
          <div className={styles.base_info}>
            <span className={styles.display_name}>
              {replaceLocalizePlaceholder(extension.displayName, `${extension.publisher}.${extension.name}`) ||
                extension.name}
            </span>
            <span className={styles.version}>{extension.version}</span>
            {!installedState && (
              <span className={styles.download_count}>
                <Icon iconClass={getIcon('download')} />
                {extension.downloadCount}
              </span>
            )}
          </div>
          <span className={styles.description}>
            {replaceLocalizePlaceholder(extension.description, `${extension.publisher}.${extension.name}`)}
          </span>
          <div className={styles.footer}>
            <span className={styles.namespace}>{extension.namespace}</span>
            {type === ExtensionViewType.MARKETPLACE &&
              (isInstalled ? (
                shouldUpdate ? (
                  <Button type='primary' size='small' onClick={onInstallCallback} disabled={installing}>
                    {localize(installing ? 'marketplace.extension.updating' : 'marketplace.extension.update')}
                  </Button>
                ) : (
                  <span className={styles.state_text}>{localize('marketplace.extension.installed')}</span>
                )
              ) : (
                <Button type='primary' size='small' onClick={onInstallCallback} disabled={installing}>
                  {localize(installing ? 'marketplace.extension.installing' : 'marketplace.extension.install')}
                </Button>
              ))}
            {type === ExtensionViewType.INSTALLED && (
              <Button type='primary' size='small' onClick={onInstallCallback} disabled={true}>
                {localize('marketplace.extension.installed')}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  },
);
