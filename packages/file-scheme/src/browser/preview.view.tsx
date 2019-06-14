import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import * as React from 'react';
import * as styles from './style.module.less';
import { useInjectable } from '@ali/ide-core-browser';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';

export const ImagePreview: ReactEditorComponent<null> = (props) => {
  const imgRef = React.useRef<HTMLImageElement>();
  const staticService = useInjectable(StaticResourceService) as StaticResourceService;

  React.useEffect(() => {
    staticService.resolveStaticResource(props.resource.uri).then((target) => {
      const src: string = target.toString();
      if (imgRef.current) {
        imgRef.current.src = src;
      }
    });
  }, [props.resource]);

  return (<div className={styles.kt_image_preview} >
    <img ref={(el) => el && (imgRef.current = el) }/>
  </div>);
};
