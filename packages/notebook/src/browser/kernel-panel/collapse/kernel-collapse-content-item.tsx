import { CaretDownOutlined, CaretRightOutlined, CloseOutlined } from '@ant-design/icons';
import React, { useState } from 'react';

import { URI, useInjectable } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';

import { LibroPanelCollapseKernelItem } from '../kernel.panel.protocol';

import { FileUnderKernel, RunningKernel } from './icon';

interface Props {
  item: LibroPanelCollapseKernelItem;
  refresh: () => void;
}

export const LibroKernelCollapseContentItem: React.FC<Props> = (props: Props) => {
  const item = props.item;
  const [open, setOpen] = useState<boolean>(true);
  const editorService = useInjectable<WorkbenchEditorServiceImpl>(WorkbenchEditorService);

  return (
    <>
      <div
        className='libro-panel-collapse-item'
        key={item.id}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <div className='libro-panel-collapse-item-toggle'>{open ? <CaretDownOutlined /> : <CaretRightOutlined />}</div>
        <div className='libro-panel-collapse-item-icon'>
          <RunningKernel></RunningKernel>
        </div>
        <div className='libro-panel-collapse-item-label'>{item.name}</div>
        <div
          className='libro-panel-collapse-item-close'
          onClick={async (e) => {
            if (item.shutdown) {
              item
                .shutdown()
                .then(() => {
                  props.refresh();
                })
                .catch(() => {
                  // console.error(error);
                });
            }
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <CloseOutlined />
        </div>
      </div>
      {open && (
        <div className='libro-panel-collapse-kernel-item-container'>
          {item.notebooks.map((notebook) => (
            <div
              className='libro-panel-collapse-kernel-item'
              key={notebook.sessionId}
              onClick={() => {
                const uri = new URI(notebook.path);
                editorService.openUris([uri]);
              }}
            >
              <div className='libro-panel-collapse-kernel-item-icon'>
                <FileUnderKernel></FileUnderKernel>
              </div>
              <div className='libro-panel-collapse-kernel-item-name'>{notebook.name}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
