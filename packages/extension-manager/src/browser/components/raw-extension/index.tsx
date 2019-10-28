import * as React from 'react';
import { RawExtension } from '../../../common';
import { localize } from '@ali/ide-core-browser';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import * as clx from 'classnames';
import * as styles from './index.module.less';
import * as commonStyles from '../../extension-manager.common.module.less';
import { Button } from '@ali/ide-core-browser/lib/components';
import { observer } from 'mobx-react-lite';

interface RawExtensionProps extends React.HTMLAttributes<HTMLDivElement> {
  extension: RawExtension;
  select: (extension: RawExtension) => void;
  install: (extension: RawExtension) => Promise<void>;
}

export const RawExtensionView: React.FC<RawExtensionProps> = observer(({
   extension, select, install, className,
  }) => {
  const [installing, setInstalling] = React.useState(false);

  async function handleInstall(e) {
    e.stopPropagation();
    setInstalling(true);
    await install(extension);
    setInstalling(false);
  }
  return (
    <div className={className}>
      <div onClick={() => select(extension)} className={styles.wrap}>
        <div>
          <img className={styles.icon} src={extension.icon}></img>
        </div>
        <div className={styles.info_wrap}>
          <div className={styles.info_header}>
            <div className={styles.name_wrapper}>
              <div className={styles.name}>{extension.displayName}</div>
              {extension.isBuiltin ? (<span className={commonStyles.tag}>{localize('marketplace.extension.builtin', '内置')}</span>) : null}
            </div>
            {!extension.installed && <Button loading={installing} onClick={handleInstall} ghost={true} style={{flexShrink: 0}}>安装</Button>}
          </div>
          <div className={styles.extension_props}>
            {extension.downloadCount ? (<span><i className={clx(commonStyles.icon, getIcon('download'))}></i>{extension.downloadCount}</span>) : null}
            <span>V{extension.version}</span>
            <span>{extension.publisher}</span>
          </div>
          <div className={styles.description}>{extension.description}</div>
          </div>
        </div>
    </div>
  );
});
