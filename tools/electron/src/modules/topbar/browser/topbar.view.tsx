import { observer } from 'mobx-react-lite';
import React from 'react';

import { Button, Badge } from '@opensumi/ide-components';
import { useInjectable, ComponentRegistryInfo } from '@opensumi/ide-core-browser';

import { ITopbarService } from '../common';

export const TopbarBadge: React.FC<{ component: ComponentRegistryInfo }> = observer(
  ({ component }) => (component.options!.badge && <Badge></Badge>) || null,
);

export const Topbar = observer(() => {
  const topbarService = useInjectable<ITopbarService>(ITopbarService);

  const onClick = () => {
    topbarService.sayHelloFromNode();
  };

  return (
    <div>
      <Button onClick={onClick}> hello </Button>
    </div>
  );
});
