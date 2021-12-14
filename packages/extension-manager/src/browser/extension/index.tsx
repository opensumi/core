import * as React from 'react';
import { useCallback, useState } from 'react';
import { localize } from '@opensumi/ide-core-common';
import { Button, Icon, getKaitianIcon } from '@opensumi/ide-components';

import { InstallState, VSXExtension } from '../../common';

import * as styles from './extension.module.less';

interface IExtensionViewProps {
  extension: VSXExtension;
  onInstall(extension: VSXExtension): Promise<string | undefined>;
  onClick(extension: VSXExtension, state: InstallState): void;
  installed: boolean;
}

export const Extension = React.memo(({ extension, onInstall, onClick, installed }: IExtensionViewProps) => {
  const [installing, setInstalling] = useState<boolean>();
  const [installedState, setInstalled] = useState<boolean>(installed);

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
    onClick(extension, installedState ? InstallState.INSTALLED : InstallState.NOT_INSTALLED);
  }, [extension]);

  return (
    <div className={styles.extension_item} onClick={onClickCallback}>
      <img
        className={styles.icon}
        src={extension.iconUrl || 'https://open-vsx.org/default-icon.png'}
        alt={extension.displayName}
      />
      <div className={styles.extension_detail}>
        <div className={styles.base_info}>
          <span className={styles.display_name}>{extension.displayName || extension.name}</span>
          <span className={styles.version}>{extension.version}</span>
          {!installedState && <span className={styles.download_count}>
            <Icon iconClass={getKaitianIcon('download')} />
            {extension.downloadCount}
          </span>}
        </div>
        <span className={styles.description}>{extension.description}</span>
        <div className={styles.footer}>
          <span className={styles.namespace}>{extension.namespace}</span>
          {!installedState && (
            <>
              <Button type='link' size='small' onClick={onInstallCallback} disabled={installing}>
                {localize(installing ? 'marketplace.extension.installing' : 'marketplace.extension.install')}
              </Button>
            </>
          )}
          {installedState && <span>{localize('marketplace.extension.installed')}</span>}
        </div>
      </div>
    </div>
  );
});
