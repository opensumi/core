import { Container, URI, ViewManager, ViewRender } from '@difizen/mana-app';
import React, { useEffect, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser/types';
import { ContentLoaderType, ManaContainer } from './mana';
import { LibroVersionManager } from './libro/diff-view/libro-version-manager';
import { AIStudioLibroVersionView } from './libro/diff-view/libro-version-view';

export const LibroVersionPreview: ReactEditorComponent = ({ resource }) => {
  const uri = resource.uri;
  const originalUri = new URI(uri.getParsedQuery().original);
  const targetUri = new URI(uri.getParsedQuery().modified);
  const manaContainer = useInjectable<Container>(ManaContainer);
  const libroVersionManager = manaContainer.get(LibroVersionManager);
  const [versionView, setVersionView] = useState<AIStudioLibroVersionView>();

  useEffect(() => {
    libroVersionManager
      .getOrCreateView({
        resource: targetUri.toString(),
        loadType: ContentLoaderType,
        originalUri,
        targetUri
      })
      .then((view) => {
        setVersionView(view);
      });
  }, []);

  return (
    <div className="libro-version">
      {versionView && <ViewRender view={versionView}></ViewRender>}
    </div>
  );
};
