import { ILogger, useInjectable } from '@ali/ide-core-browser';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { Markdown } from '@ali/ide-markdown';
import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { ExtensionDetail, IExtensionManagerService } from '../common';
import * as clx from 'classnames';
import * as styles from './extension-detail.module.less';

export const ExtensionDetailView: ReactEditorComponent<null> = observer((props) => {
  const extensionId = props.resource.uri.authority;
  const [extension, setExtension] = React.useState<ExtensionDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [tabIndex, setTabIndex] = React.useState(0);
  const tabs = [{
    name: 'readme',
    displayName: 'Details',
  }, {
    name: 'changelog',
    displayName: 'Changelog',
  }];

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const logger = useInjectable<ILogger>(ILogger);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const extension = await extensionManagerService.getDetailById(extensionId);
        setExtension(extension);
      } catch (err) {
        logger.error(err);
      }
      setIsLoading(false);
    };

    fetchData();
  }, [extensionId]);

  function getContent(name: string, extension: ExtensionDetail) {
    switch (name) {
      case 'readme':
        return <Markdown content={extension.readme}/>;
      case 'changelog':
        return <Markdown content={extension.changelog}/>;
      default:
        return null;
    }
  }

  return (
    <div className={styles.wrap}>
      {extension && (
      <>
        <div className={styles.header}>
          <div>
            <img className={styles.icon} src={extension.icon}></img>
          </div>
          <div className={styles.details}>
            <div className={styles.title}>
              <span className={styles.name}>{extension.displayName}</span>
              <span className={styles.identifier}>{extension.id}</span>
            </div>
            <div className={styles.subtitle}>
              <span className={styles.publisher}>{extension.publisher}</span>
            </div>
            <div className={styles.description}>{extension.description}</div>
            {/* <div className={styles.actions}>
              <div>启用</div>
            </div> */}
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.navbar}>
            <ul className={styles.actions_container}>
              {tabs.map((tab, index) => (
                <li key={tab.name} className={styles.action_item}>
                  <a className={clx(styles.action_label, {
                    [styles.action_label_show]: index === tabIndex,
                  })} onClick={() => setTabIndex(index)}>{tab.displayName}</a>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.content}>
            {tabs.map((tab, index) => (
              <div className={clx(styles.content_item, {
                [styles.content_item_show]: index === tabIndex,
              })}>{getContent(tab.name, extension)}</div>
            ))}
          </div>
        </div>
      </>
      )}
    </div>
  );
});
