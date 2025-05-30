import {
  BaseView,
  ViewInstance,
  ViewOption,
  ViewRender,
  inject,
  prop,
  transient,
  useInject,
  view,
} from '@difizen/libro-common/app';
import { LibroView } from '@difizen/libro-core';
import React, { forwardRef } from 'react';

import type { LibroDiffView } from './';
const LibroVersionRender = forwardRef<HTMLDivElement>((_props, ref) => {
  const aistudioLibroVersionView = useInject<AIStudioLibroVersionView>(ViewInstance);
  return (
    <div className='libro-version-content' ref={ref}>
      {aistudioLibroVersionView.isDiff
        ? aistudioLibroVersionView.libroDiffView && <ViewRender view={aistudioLibroVersionView.libroDiffView} />
        : aistudioLibroVersionView.libro && <ViewRender view={aistudioLibroVersionView.libro} />}
    </div>
  );
});

@transient()
@view('libro-version-view')
export class AIStudioLibroVersionView extends BaseView {
  view = LibroVersionRender;
  @inject(ViewOption) options: any;
  @prop()
  isDiff: boolean = false;
  // for git preview
  @prop()
  libro: LibroView;
  // for git diff
  @prop()
  libroDiffView: LibroDiffView;
  onViewMount() {}
}
