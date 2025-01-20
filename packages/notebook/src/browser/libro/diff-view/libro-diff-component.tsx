import { ViewManager, ViewRender, useInject } from '@difizen/mana-app';
import React, { useEffect, useState } from 'react';

import { libroDiffViewFactoryId } from './libro-diff-protocol';

import type { DiffOption } from './libro-diff-protocol';
import type { LibroDiffView } from './libro-diff-view';

export function LibroDiffComponent(props: { options: DiffOption }) {
  const [libroDiffView, setLibroDiffView] = useState<LibroDiffView | undefined>(undefined);
  const viewManager = useInject(ViewManager);
  useEffect(() => {
    viewManager
      .getOrCreateView<LibroDiffView>(libroDiffViewFactoryId, {
        ...(props.options || {}),
      })
      .then((view) => {
        setLibroDiffView(view);
      });
  }, []);
  if (!libroDiffView || !libroDiffView.view) {
    return null;
  }
  return <ViewRender view={libroDiffView} />;
}
