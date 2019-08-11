import * as React from 'react';
import * as styles from './view-container.module.less';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { ExtensionViewContianerService } from './view-container.service';
export interface ViewItem {
  id: string;
  name: string;
  when: string;
}

export interface ExtensionViewContainerProps {
  views?: ViewItem[];
  containerId?: string;
}

export const ExtensionViewContainer = observer(({
  views,
  containerId,
}: React.PropsWithChildren<ExtensionViewContainerProps>) => {
  const extensionViewContianerService = useInjectable(ExtensionViewContianerService);
  React.useEffect(() => {
    extensionViewContianerService.registerViewContainer(containerId, views);
  }, []);
  console.log(views, containerId);
  let containerTitle;
  if (containerId && views && views.length === 1) {
    containerTitle = `${containerId.replace('-', ' ').toUpperCase()} ${views[0].name.toUpperCase()}`;
  }
  return <div>
    <div className={ styles.kt_extension_container_header }>
      <div className={ styles.kt_extension_container_title }>
        {containerTitle}
      </div>

    </div>
    {
      views && views.map((view) => {
        return <div>{view.name }</div>;
      })
    }
  </div>;
});
