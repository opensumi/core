import React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import styles from './styles.module.less';

interface IDropAreaProps {
  location: string;
}

const DropArea: React.FC<IDropAreaProps> = (props) => {
  const { location } = props;
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);

  return (
    <div
      className={styles.drop_area}
      onDrop={(e) => {
        const containerId = e.dataTransfer?.getData('containerId');
        layoutService.moveContainerTo(containerId, location);
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
    >
      drop here
    </div>
  );
};

export const RightDropArea = () => <DropArea location='right' />;

export const BottomDropArea = () => <DropArea location='bottom' />;
