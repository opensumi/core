import React, { memo } from 'react';

import { Disposable, useInjectable } from '@opensumi/ide-core-browser';
import { StaticResourceService } from '@opensumi/ide-core-browser/lib/static-resource';
import { IResource, ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';

import styles from './style.module.less';

const useResource = (resource: IResource) => {
  const staticService = useInjectable<StaticResourceService>(StaticResourceService);

  const src = React.useMemo(() => staticService.resolveStaticResource(resource.uri).toString(), [resource]);

  return {
    src,
  };
};

export const VideoPreview: ReactEditorComponent<null> = memo((props) => {
  const { src } = useResource(props.resource);
  return (
    <div className={styles.kt_video_preview}>
      <video playsInline controls className={styles.kt_video} src={src} />
    </div>
  );
});

export const ImagePreview: ReactEditorComponent<null> = (props) => {
  const imgRef = React.useRef<HTMLImageElement>();
  const imgContainerRef = React.useRef<HTMLDivElement>();
  const { src } = useResource(props.resource);

  React.useEffect(() => {
    const disposer = new Disposable();
    if (imgRef.current) {
      imgRef.current.src = src;
    }
    return () => {
      disposer.dispose();
    };
  }, [props.resource]);

  return (
    <div className={styles.kt_image_preview}>
      <div ref={imgContainerRef as any}>
        <img ref={(el) => el && (imgRef.current = el)} />
      </div>
    </div>
  );
};
