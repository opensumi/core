import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { useInjectable, ILogger } from '@ali/ide-core-browser';
import { IExtensionManagerService, ExtensionDetail } from '../common';
import * as styles from './extension-detail.module.less';
import { IWebviewService } from '@ali/ide-webview';
import { Markdown } from '@ali/ide-markdown';

export const ExtensionDetailView: ReactEditorComponent<null> = observer((props) => {
  const extensionId = props.resource.uri.authority;
  const [extension, setExtension] = React.useState<ExtensionDetail | null>(null);
  const ref = React.useRef<HTMLElement | null>();
  const [isLoading, setIsLoading] = React.useState(false);

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
    console.log('extensionId', extensionId);
  }, [extensionId]);

  React.useEffect(() => {
    if (ref.current && extension) {
      // markdownService.previewMarkdownInContainer(extension.readme, ref.current)
    }

  }, [ref, extension]);

  return (
    <div>
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
              <li className={styles.action_item}>
                <a className={styles.action_label}>Details</a>
              </li>
            </ul>
          </div>
          <div className={styles.content}>
            <Markdown content={extension.readme} />
          </div>
      </div>
      </>
      )}
    </div>
  );
});
