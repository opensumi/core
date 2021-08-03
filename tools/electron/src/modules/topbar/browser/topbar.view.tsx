import React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, ComponentRegistryInfo } from '@ali/ide-core-browser';
import { Button, Badge } from '@ali/ide-components';
import { ITopbarService } from '../common';

export const TopbarBadge: React.FC<{ component: ComponentRegistryInfo }> = observer(({ component }) => {
  return (component.options!.badge && <Badge></Badge>) || null;
});

export const Topbar = observer(() => {
  const topbarService = useInjectable<ITopbarService>(ITopbarService);

  const onClick = () => {
    topbarService.sayHelloFromNode();
  };

  return <div>
    <Button onClick={onClick}> hello </Button>
  </div>;
});
