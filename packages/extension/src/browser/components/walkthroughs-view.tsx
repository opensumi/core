import clx from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';

import { Button, CheckBox } from '@opensumi/ide-components';
import { IContextKeyService, ILink, IOpenerService, useInjectable } from '@opensumi/ide-core-browser';
import { renderLabelWithIcons } from '@opensumi/ide-core-browser/lib/utils/iconLabels';
import { IResource } from '@opensumi/ide-editor';
import { Markdown } from '@opensumi/ide-markdown';
import { IThemeService } from '@opensumi/ide-theme';

import { IWalkthrough, IWalkthroughStep } from '../../common';
import { WalkthroughsService } from '../walkthroughs.service';

import * as styles from './walkthroughs-view.module.less';

export const WalkthroughsEditorView: React.FC<{ resource: IResource }> = ({ resource: { uri } }) => {
  const walkthroughsService: WalkthroughsService = useInjectable(WalkthroughsService);
  const contextKeyService: IContextKeyService = useInjectable(IContextKeyService);
  const { query: id, authority: extensionId } = uri;

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

  const getCurrentStep = useCallback(
    () => walkthrough && walkthrough.steps.find((s) => s.id === currentStepId)?.media,
    [currentStepId, walkthrough],
  );

  return (
    <div className={styles.getting_started_container}>
      <div className={styles.getting_started_detailsContent}>
        {/* 左侧顶部标题和简介 */}
        <div className={styles.category_container}>
          <div className={styles.category_icon}>
            {walkthrough && walkthrough.icon.type === 'image' && <img src={walkthrough.icon.path} />}
          </div>
          <div className={styles.category_description_container}>
            <h2 className={styles.category_title}>{walkthrough?.title}</h2>
            <div className={styles.category_description}>{walkthrough?.description}</div>
          </div>
        </div>
        {/* 左侧中间 step 流程 */}
        <div className={styles.steps_container}>
          <div className={styles.getting_started_detail_container}>
            <div className={styles.step_list_container}>
              {walkthrough
                ? walkthrough.steps
                    .filter((s) => contextKeyService.match(s.when))
                    .map((s) => (
                      <StepItem
                        key={s.id}
                        step={s}
                        isExpanded={s.id === currentStepId}
                        onSelected={setCurrentStepId}
                      ></StepItem>
                    ))
                : null}
            </div>
          </div>
        </div>
        {/* 右侧资源视图 */}
        <div className={styles.getting_started_media}>
          {currentStepId && (
            <MediaContainer media={getCurrentStep()} extensionId={extensionId} stepId={currentStepId}></MediaContainer>
          )}
        </div>
      </div>
    </div>
  );
};

const StepItem: React.FC<{ step: IWalkthroughStep; isExpanded: boolean; onSelected: (id: string) => void }> = ({
  step,
  isExpanded,
  onSelected,
}) => {
  const openerService: IOpenerService = useInjectable(IOpenerService);
  const walkthroughsService: WalkthroughsService = useInjectable(WalkthroughsService);
  const [isCheck, setIsCheck] = useState<boolean>(false);
  const { description } = step;

  useEffect(() => {
    const disposable = walkthroughsService.onDidProgressStep((event) => {
      const { id, done } = event;
      if (id === step.id) {
        if (done) {
          setIsCheck(done);
        }
      }
    });

    return () => disposable.dispose();
  }, []);

  const handleCheckboxChange = () => {
    setIsCheck(!isCheck);
    walkthroughsService.progressByEvent('stepSelected:' + step.id);
  };

  const handleOpen = (node: ILink) => {
    const { href } = node;
    openerService.open(href);

    if (href.startsWith('https://') || href.startsWith('http://')) {
      walkthroughsService.progressByEvent('onLink:' + href);
    }
  };

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
            <Button onClick={() => handleOpen(node)}>{renderLabelWithIcons(node.label)}</Button>
          </div>,
        );
      } else {
        const textNodes = desc.nodes.map((node, idx) => {
          if (typeof node === 'string') {
            return node;
          } else {
            return (
              <a key={node.label + '#' + idx} title={node.title} onClick={() => handleOpen(node)}>
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
    <div
      className={clx(styles.getting_started_step, isExpanded && styles.expanded)}
      onClick={() => onSelected(step.id)}
    >
      <div className={styles.checkbox}>
        <CheckBox id={step.id} onChange={handleCheckboxChange} checked={isCheck}></CheckBox>
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
const MediaContainer: React.FC<{
  media: IWalkthroughStep['media'] | undefined;
  extensionId: string;
  stepId: string;
}> = ({ media, extensionId, stepId }) => {
  const themeService: IThemeService = useInjectable(IThemeService);
  const walkthroughsService: WalkthroughsService = useInjectable(WalkthroughsService);
  const [svgContent, setSvgContent] = useState<string>('');
  const [markdownContent, setMarkdownContent] = useState<string>('');

  const readFileContent = useCallback(
    async (path: string) => {
      if (media?.type === 'image') {
        return '';
      }
      if (path) {
        const content = await walkthroughsService.getFileContent(extensionId, path);
        return content.toString();
      }
      return '';
    },
    [media],
  );

  useEffect(() => {
    const rawStep = walkthroughsService.getStepsByExtension(stepId);
    if (!rawStep) {
      return;
    }

    if (media && media.type === 'svg' && rawStep.media.svg) {
      readFileContent(rawStep.media.svg).then(setSvgContent);
    }
    if (media && media.type === 'markdown' && rawStep.media.markdown) {
      readFileContent(rawStep.media.markdown).then(setMarkdownContent);
    }
  }, [media, stepId]);

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
        <div className={styles.media_svg_container} dangerouslySetInnerHTML={{ __html: svgContent }}></div>
      </React.Fragment>
    );
  }

  if (media.type === 'markdown') {
    return (
      <React.Fragment>
        <MarkdownMedia content={markdownContent} media={media}></MarkdownMedia>
      </React.Fragment>
    );
  }

  return null;
};

const MarkdownMedia: React.FC<{ content: string; media: IWalkthroughStep['media'] }> = ({ content, media }) => {
  const openerService: IOpenerService = useInjectable(IOpenerService);
  if (media.type !== 'markdown') {
    return null;
  }

  const relativePath = useCallback(() => media.base.resolve('/').toString(), [media, content]);

  return (
    <Markdown
      content={content}
      options={{ baseUrl: relativePath() }}
      onLinkClick={(uri) => openerService.open(uri)}
    ></Markdown>
  );
};
