import { LibroView } from '@difizen/libro-core';
import { BaseView, ViewInstance, ViewOption, ViewRender, inject, prop, transient, useInject, view } from '@difizen/mana-app';
import React, { forwardRef } from 'react';
import { Switch } from 'antd';
import type { LibroDiffView } from './';
const LibroVersionRender = forwardRef<HTMLDivElement>((props, ref) => {
    const aistudioLibroVersionView = useInject<AIStudioLibroVersionView>(ViewInstance);
    // const headerLeftArgs = useMemo(() => {
    //   return [aistudioLibroVersionView.libro, LibroVersionHeader];
    // }, [aistudioLibroVersionView.libro]);

    return (
      <div className="libro-version-container" ref={ref}>
        {/* TODO: header 功能？ */}
        <div className="libro-version-header">
          <Switch onChange={() => aistudioLibroVersionView.isDiff = !aistudioLibroVersionView.isDiff} defaultChecked={false} title='切换Diff视图' />
        </div>
        <div className="libro-version-diff-header">
          {/* {aistudioLibroVersionView.isDiff && aistudioLibroVersionView.libroDiffView && (
            <LibroDiffHeader />
          )} */}
        </div>
        <div className="libro-version-content">
          {aistudioLibroVersionView.isDiff
            ? aistudioLibroVersionView.libroDiffView && (
                <ViewRender view={aistudioLibroVersionView.libroDiffView} />
              )
            : aistudioLibroVersionView.libro && <ViewRender view={aistudioLibroVersionView.libro} />}
        </div>
      </div>
    );
  });

  @transient()
  @view('libro-version-view')
  export class AIStudioLibroVersionView extends BaseView {
    view = LibroVersionRender;
    @inject(ViewOption) options: any; // Placeholder until LibroVersionViewOption is defined
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
