import { useEffect, useState } from 'react';
import { useInject } from '@alipay/mana-observable';
import { ViewManager, ViewRender } from '@alipay/mana-core';
import type { DiffOption } from './libro-diff-protocol';
import { libroDiffViewFactoryId } from './libro-diff-protocol';
import type { LibroDiffView } from './libro-diff-view';

export function LibroDiffComponent(props: { options: DiffOption }) {
  const [libroDiffView, setLibroDiffView] = useState<LibroDiffView | undefined>(undefined);
  const viewManager = useInject(ViewManager);
  useEffect(() => {
    viewManager
      .getOrCreateView<LibroDiffView>(libroDiffViewFactoryId, {
        ...(props.options || {}),
      })
      .then(view => {
        setLibroDiffView(view);
      });
  }, []);
  if (!libroDiffView || !libroDiffView.view) return null;
  return <ViewRender view={libroDiffView} />;
}
