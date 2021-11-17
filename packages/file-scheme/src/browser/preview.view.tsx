import { ReactEditorComponent, IResource } from '@ide-framework/ide-editor/lib/browser';
import React from 'react';
import styles from './style.module.less';
import { useInjectable, Disposable, DomListener } from '@ide-framework/ide-core-browser';
import { StaticResourceService } from '@ide-framework/ide-static-resource/lib/browser';

const useResource = (resource: IResource) => {
  const staticService = useInjectable<StaticResourceService>(StaticResourceService);

  const src = React.useMemo(() => {
    return staticService.resolveStaticResource(resource.uri).toString();
  }, [ resource ]);

  return {
    src,
  };
};

export const VideoPreview: ReactEditorComponent<null> = (props) => {
  const { src } = useResource(props.resource);

  return (
    <div className={styles.kt_video_preview}>
      <video autoPlay controls className={styles.kt_video} src={src}></video>
    </div>
  );
};

export const ImagePreview: ReactEditorComponent<null> = (props) => {
  const imgRef = React.useRef<HTMLImageElement>();
  const imgContainerRef = React.useRef<HTMLDivElement>();
  const { src } = useResource(props.resource);

  React.useEffect(() => {
    const disposer = new Disposable();
    if (imgRef.current) {
      imgRef.current.src = src;
      const last = imgRef.current;
      imgRef.current.onload = (ev) => {
        if (last !== imgRef.current) {
          // 已经不是同一个元素，放弃
          return;
        }
        if (imgContainerRef.current && imgRef.current) {
          const container = imgContainerRef.current!;
          let delta = 0;
          const originalWidth = imgRef.current!.width;
          const originalHeight = imgRef.current!.height;
          const scale = originalHeight / originalWidth;
          function setSize() {
            container.style.width = originalWidth + delta + 'px';
            container.style.height = originalHeight + (delta * scale) + 'px';
          }
          setSize();
          disposer.addDispose(new DomListener(container.parentElement!, 'wheel', (e) => {
            // ctrlKey 为 true 代表 mac 上的 pinch gesture
            if (e.ctrlKey) {
              if (e.deltaY > 0) {
                e.preventDefault();
                delta -= e.deltaY * 10;
                setSize();
              } else if (e.deltaY < 0) {
                e.preventDefault();
                delta -= e.deltaY * 10;
                setSize();
              }
            }
          }));
        }
      };
    }
    return () => {
      disposer.dispose();
    };
  }, [props.resource]);

  return (<div className={styles.kt_image_preview} >
    <div ref={imgContainerRef as any}>
      <img ref={(el) => el && (imgRef.current = el) }/>
    </div>
  </div>);
};
