import { Container, URI, ViewRender } from '@difizen/libro-common/app';
import React, { useEffect, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser/types';

import { LibroVersionManager } from './libro/diff-view/libro-version-manager';
import { AIStudioLibroVersionView } from './libro/diff-view/libro-version-view';
import { ContentLoaderType, ManaContainer } from './mana';

export const LibroVersionPreview: ReactEditorComponent = ({ resource }) => {
  const uri = resource.uri;
  const originalUri = uri.scheme === 'diff' ? new URI(decodeURIComponent(uri.getParsedQuery().original)) : undefined;
  const targetUri = uri.scheme === 'diff' ? new URI(decodeURIComponent(uri.getParsedQuery().modified)) : undefined;
  const manaContainer = useInjectable<Container>(ManaContainer);
  const libroVersionManager = manaContainer.get(LibroVersionManager);
  const [versionView, setVersionView] = useState<AIStudioLibroVersionView>();

  useEffect(() => {
    libroVersionManager
      .getOrCreateView({
        resource: uri.toString(),
        loadType: ContentLoaderType,
        originalUri,
        targetUri,
      })
      .then((view) => {
        setVersionView(view);
      });
  }, [uri]);

  return <div className='libro-version'>{versionView && <ViewRender view={versionView}></ViewRender>}</div>;
};
