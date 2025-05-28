import React from 'react';

import { SlotLocation, localize, useInjectable } from '@opensumi/ide-core-browser';

import { IMainLayoutService } from '../../common';

import styles from './styles.module.less';

interface IDropAreaProps {
  location: string;
}

const DropArea: React.FC<IDropAreaProps> = (props) => {
  const { location } = props;
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      const containerId = e.dataTransfer?.getData('containerId');
      layoutService.moveContainerTo(containerId, location);
      layoutService.hideDropArea();
    },
    [layoutService, location],
  );

  return (
    <div
      className={styles.drop_area}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
      }}
    >
      {localize('main-layout.drop-area.tip')}
    </div>
  );
};

export const ViewDropArea = () => <DropArea location={SlotLocation.view} />;

export const ExtendViewDropArea = () => <DropArea location={SlotLocation.extendView} />;

export const PanelDropArea = () => <DropArea location={SlotLocation.panel} />;
