import clx from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';

import { Button, CheckBox } from '@opensumi/ide-components';
import { IOpenerService, useInjectable } from '@opensumi/ide-core-browser';
import { renderLabelWithIcons } from '@opensumi/ide-core-browser/lib/utils/iconLabels';
import { FileType } from '@opensumi/ide-core-common';
import { IResource } from '@opensumi/ide-editor';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { FileServiceClient } from '@opensumi/ide-file-service/lib/browser/file-service-client';
import { Markdown } from '@opensumi/ide-markdown';
import { IThemeService } from '@opensumi/ide-theme';

import { IWalkthrough, IWalkthroughStep } from '../../common';
import { WalkthroughsService } from '../walkthroughs.service';


import * as styles from './walkthroughs-view.module.less';

export const WalkthroughsEditorView: React.FC<{ resource: IResource }> = ({ resource: { uri } }) => {
  const walkthroughsService: WalkthroughsService = useInjectable(WalkthroughsService);
  const { query: id } = uri;

  const [walkthrough, setWalkthrough] = useState<IWalkthrough | undefined>();
  const [currentStepId, setCurrentStepId] = useState<string>();

  useEffect(() => {
    if (walkthrough && walkthrough.steps.length > 0) {
      // 默认选第一个 step
      if (!currentStepId) {
        setCurrentStepId(walkthrough.steps[0].id);
      }
    }
  }, [walkthrough]);

  useEffect(() => {
    if (id) {
      setWalkthrough(walkthroughsService.getWalkthrough(id));
    }
  }, [id]);

  const getCurrentStep = useCallback(() => walkthrough && walkthrough.steps.find((s) => s.id === currentStepId)?.media, [currentStepId, walkthrough]);

  return (
    <div className={styles.getting_started_container}>
      <div className={styles.getting_started_detailsContent}>
        <div className={styles.getting_started_left}>
          {/* 左侧顶部标题和简介 */}
          <div className={styles.category_container}>
            <div className={styles.category_icon}></div>
            <div className={styles.category_description_container}>
              <div className={styles.category_title}>{walkthrough?.title}</div>
              <div className={styles.category_description}>{walkthrough?.description}</div>
            </div>
          </div>
          {/* 左侧中间 step 流程 */}
          <div className={styles.steps_container}>
            <div className={styles.getting_started_detail_container}>
              <div className={styles.step_list_container}>
                {walkthrough
                  ? walkthrough.steps.map((s) => (
                      <StepItem
                        key={s.id}
                        step={s}
                        isExpanded={s.id === currentStepId}
                        onCheck={setCurrentStepId}
                      ></StepItem>
                    ))
                  : null}
              </div>
            </div>
          </div>
        </div>
        {/* 右侧资源视图 */}
        <div className={styles.getting_started_media}>
          <Media media={getCurrentStep()}></Media>
        </div>
      </div>
    </div>
  );
};

const StepItem: React.FC<{ step: IWalkthroughStep; isExpanded: boolean; onCheck: (id: string) => void }> = ({
  step,
  isExpanded,
  onCheck,
}) => {
  const openerService: IOpenerService = useInjectable(IOpenerService);
  const { description } = step;

  const getDescriptionComplexElements = useCallback(() => {
    if (description.length === 0) {
      return null;
    }
    const lineElements: React.ReactElement[] = [];
    description.map((desc) => {
      if (desc.nodes.length === 1 && typeof desc.nodes[0] !== 'string') {
        const node = desc.nodes[0];
        lineElements.push(
          <div key={lineElements.length} title={node.title}>
            <Button onClick={() => openerService.open(node.href)}>{renderLabelWithIcons(node.label)}</Button>
          </div>,
        );
      } else {
        const textNodes = desc.nodes.map((node, idx) => {
          if (typeof node === 'string') {
            return node;
          } else {
            return (
              <a key={node.label + '#' + idx} title={node.title} onClick={() => openerService.open(node.href)}>
                {node.label}
              </a>
            );
          }
        });
        lineElements.push(<p key={lineElements.length}>{textNodes}</p>);
      }
    });

    return (
      <div className={styles.step_description_container}>
        <React.Fragment>{lineElements}</React.Fragment>
      </div>
    );
  }, [description]);

  const renderLabel = useCallback(() => renderLabelWithIcons(step.title), [step.title]);

  return (
    <div className={clx(styles.getting_started_step, isExpanded && styles.expanded)} onClick={() => onCheck(step.id)}>
      <div className={styles.checkbox}>
        <CheckBox id={step.id} onChange={() => {}} checked={false}></CheckBox>
      </div>
      <div className={styles.step_container}>
        <h3 className={styles.step_title}>{renderLabel()}</h3>
        {isExpanded && getDescriptionComplexElements()}
      </div>
    </div>
  );
};

/**
 * media 有 img、svg、markdown 三种格式
 */
const Media: React.FC<{ media: IWalkthroughStep['media'] | undefined }> = ({ media }) => {
  const themeService: IThemeService = useInjectable(IThemeService);
  const fileSystem: FileServiceClient = useInjectable(IFileServiceClient);
  const openerService: IOpenerService = useInjectable(IOpenerService);
  const [svgContent, setSvgContent] = useState<string>('');
  const [markdownContent, setMarkdownContent] = useState<string>('');

  const readFileContent = useCallback(
    async (path: string) => {
      if (media?.type === 'image') {
        return '';
      }
      const stat = await fileSystem.getFileStat(path);
      if (stat && stat.type === FileType.File) {
        const { content } = await fileSystem.readFile(path);
        return content.toString();
      }
      return '';
    },
    [media],
  );

  useEffect(() => {
    if (media && media.type === 'svg') {
      readFileContent(media.path.toString()).then(setSvgContent);
    }
    if (media && media.type === 'markdown') {
      readFileContent(media.path.toString()).then(setMarkdownContent);
    }
  }, [media]);

  if (!media) {
    return null;
  }

  if (media.type === 'image') {
    const themeType = themeService.getCurrentThemeSync().type;
    const src = media.path[themeType].toString(true).replace(/ /g, '%20');
    return (
      <React.Fragment>
        <img alt={media.altText} srcSet={src.toLowerCase().endsWith('.svg') ? src : src + ' 1.5x'} />
      </React.Fragment>
    );
  }

  // 由于 svg 标签里可能存在 command: 的 href link，所以需要直接读取文件渲染 svg 标签，然后拦截点击事件给 openservice
  if (media.type === 'svg') {
    return (
      <React.Fragment>
        <div dangerouslySetInnerHTML={{ __html: svgContent }}></div>
      </React.Fragment>
    );
  }

  if (media.type === 'markdown') {
    return (
      <React.Fragment>
        <Markdown content={markdownContent} onLinkClick={(uri) => openerService.open(uri)}></Markdown>
      </React.Fragment>
    );
  }

  return null;
};
