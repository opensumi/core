import * as React from 'react';
import { useCallback, useState } from 'react';
import { localize } from '@ide-framework/ide-core-common';
import { Button, Icon, getKaitianIcon } from '@ide-framework/ide-components';

import { VSXExtension } from '../../common';

import * as styles from './extension.module.less';

interface IExtensionViewProps {
  extension: VSXExtension;
  onInstall(extension: VSXExtension): Promise<string | undefined>;
  onClick(extension: VSXExtension): void;
}

export const Extension = ({ extension, onInstall, onClick }: IExtensionViewProps) => {
  const [installing, setInstalling] = useState<boolean>();
  const [installed, setInstalled] = useState<boolean>();

  const onInstallCallback = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setInstalling(true);
    onInstall(extension)
      .then(() => {
        setInstalling(false);
        setInstalled(true);
      });
  }, [extension]);

  const onClickCallback = useCallback(() => {
    onClick(extension);
  }, [extension]);

  return (
    <div className={styles.extension_item} onClick={onClickCallback}>
      <img className={styles.icon} src={extension.iconUrl || 'https://open-vsx.org/default-icon.png'} alt={extension.displayName} />
      <div className={styles.extension_detail}>
        <div className={styles.base_info}>
          <span className={styles.display_name}>{extension.displayName || extension.name}</span>
          <span className={styles.version}>{extension.version}</span>
          <span className={styles.download_count}>
            <Icon iconClass={getKaitianIcon('download')} />
            {extension.downloadCount}
          </span>
        </div>
        <span className={styles.description}>{extension.description}</span>
        <div className={styles.footer}>
          <span className={styles.namespace}>{extension.namespace}</span>
          {!installed && <Button type='link' size='small' onClick={onInstallCallback} disabled={installing}>
            {localize(installing ? 'marketplace.extension.installing' : 'marketplace.extension.install')}
          </Button>}
          {installed && <span>{localize('marketplace.extension.installed')}</span>}
        </div>
      </div>
    </div>
  );
};
