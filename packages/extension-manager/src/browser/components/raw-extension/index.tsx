import * as React from 'react';
import { RawExtension } from '../../../common';
import * as styles from './index.module.less';

interface RawExtensionProps extends React.HTMLAttributes<HTMLDivElement> {
  extension: RawExtension;
  select: (extensionId: string) => void;
}

export default function({ extension, select, className }: RawExtensionProps) {
  return (
    <div className={className}>
      <div onClick={() => select(extension.id)} className={styles.wrap}>
        <div>
          <img className={styles.icon} src={extension.icon}></img>
        </div>
        <div className={styles.info_wrap}>
          <div className={styles.name_wrapper}>
            <div className={styles.name}>{extension.displayName}</div>
            <span className={styles.version}>{extension.version}</span>
          </div>
          <div className={styles.description}>{extension.description}</div>
          <div className={styles.publisher}>{extension.publisher}</div>
          </div>
        </div>
    </div>

  );
}
