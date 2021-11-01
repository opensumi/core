import React from 'react';
import clx from 'classnames';
import { useInjectable } from '@ali/ide-core-browser';
import { ExtensionListProps as ExtensionPackProps } from './../extension-list';
import { RawExtensionView } from './../raw-extension';
import { RawExtension, IExtensionManagerService } from '../../../common';

import styles from './index.module.less';

export const ExtensionPack: React.FC<ExtensionPackProps> = (props) => {
  const {
    list,
    showExtraAction,
  } = props;
  const [selectExtensionId, setSelectExtensionId] = React.useState('');
  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);

  function select(extension: RawExtension, isDouble: boolean) {
    setSelectExtensionId(extension.extensionId);
    extensionManagerService.openExtensionDetail({
      publisher: extension.publisher,
      name: extension.name,
      displayName: extension.displayName || extension.name,
      icon: extension.icon,
      preview: !isDouble,
      remote: !extension.installed,
      version: extension.version,
    });
  }

  async function install(extension: RawExtension) {
    await extensionManagerService.installExtension(extension);
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.head}>Extension Pack({props.list.length})</h1>
      <div>
        {list?.filter((ext) => !!ext)?.map((rawExtension, index) => {
          return (<RawExtensionView className={clx({
            [styles.selected]: rawExtension.extensionId === selectExtensionId,
            [styles.last_item]: index === list.length - 1,
          })}
          key={`${rawExtension.extensionId}_${rawExtension.version}`}
          extension={rawExtension}
          select={select}
          install={install}
          showExtraAction={showExtraAction}
          />);
        })}
      </div>
    </div>
  );
};
