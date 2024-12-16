import { Container, URI, ViewRender } from '@difizen/mana-app';
import React, { useEffect, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';

import { ManaContainer } from './mana';
import { LibroVersionManager } from './libro/libro-version-manager';
import { AIStudioLibroVersionView } from './libro/libro-version.view';

export const LibroVersionPreview: React.FC = (...params) => {
  const uri = (params[0] as Record<string, any>).resource.uri as URI;
  const previewType = uri.getParsedQuery().previewType;
  const loadType = uri.getParsedQuery().loadType;
  const gmtCreate = uri.getParsedQuery().gmtCreate;
  const originFilePath = uri.getParsedQuery().originFilePath;
  const originUri = new URI(originFilePath);
  const id = Number(uri.getParsedQuery().id);
  const manaContainer = useInjectable<Container>(ManaContainer);
  // FIXME: 使用 git 版本服务
  const libroVersionService =
    useInjectable<LibroVersionService>(ILibroVersionService);
  const libroVersionManager = manaContainer.get(LibroVersionManager);
  const [versionView, setVersionView] = useState<AIStudioLibroVersionView>();

  useEffect(() => {
    const curVersion = libroVersionService.versionMap.get(id);
    libroVersionManager
      .getOrCreateView({
        originFileName: originUri.path.name,
        originFilePath: originUri.path.toString(),
        gmtCreate,
        currentVersion: curVersion,
        loadType,
        previewType,
        versionId: id,
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
