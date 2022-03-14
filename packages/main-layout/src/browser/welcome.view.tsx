import clsx from 'classnames';
import React from 'react';

import { Button } from '@opensumi/ide-components/lib/button';
import { getExternalIcon, IOpenerService, useInjectable } from '@opensumi/ide-core-browser';
import { IContextKeyService } from '@opensumi/ide-core-browser';
import { parseLinkedText } from '@opensumi/ide-core-common/lib/linkedText';

import { IViewContentDescriptor } from '../common';

import styles from './accordion/styles.module.less';
import { ViewsController } from './views-registry';


export namespace CSSIcon {
  export const iconNameSegment = '[A-Za-z0-9]+';
  export const iconNameExpression = '[A-Za-z0-9\\-]+';
  export const iconModifierExpression = '~[A-Za-z]+';
}

const labelWithIconsRegex = new RegExp(
  `(\\\\)?\\$\\((${CSSIcon.iconNameExpression}(?:${CSSIcon.iconModifierExpression})?)\\)`,
  'g',
);

export function renderLabelWithIcons(text: string): Array<React.ReactElement | string> {
  const elements = new Array<React.ReactElement | string>();
  let match: RegExpMatchArray | null;

  let textStart = 0;
  let textStop = 0;
  while ((match = labelWithIconsRegex.exec(text)) !== null) {
    textStop = match.index || 0;
    elements.push(text.substring(textStart, textStop));
    textStart = (match.index || 0) + match[0].length;

    const [, escaped, codicon] = match;
    elements.push(escaped ? `$(${codicon})` : <span className={getExternalIcon(codicon)}></span>);
  }

  if (textStart < text.length) {
    elements.push(text.substring(textStart));
  }
  return elements;
}

const WelcomeContent = (props: { contents: IViewContentDescriptor[] }) => {
  const { contents } = props;
  const [disables, setDisables] = React.useState<(boolean | null)[]>(
    contents.map((item) => (item.precondition ? false : null)),
  );
  const contextKeyService: IContextKeyService = useInjectable(IContextKeyService);
  const openerService: IOpenerService = useInjectable(IOpenerService);

  React.useEffect(() => {
    const conditionKeys = contents.map((item) => {
      if (item.precondition) {
        const keys = new Set();
        item.precondition.keys().forEach((key) => keys.add(key));
        return keys;
      }
      return null;
    });
    const disposable = contextKeyService.onDidChangeContext((e) => {
      conditionKeys.forEach((keysOrNull, index) => {
        if (keysOrNull && e.payload.affectsSome(keysOrNull)) {
          setDisables(
            disables.map((item, idx) => (idx === index ? contextKeyService.match(contents[index].precondition) : item)),
          );
        }
      });
    });
    return () => disposable.dispose();
  }, [contents]);

  if (contents.length === 0) {
    return null;
  }
  return (
    <>
      {contents.map(({ content, precondition }, index) => {
        const lines = content.split('\n');
        const lineElements: React.ReactElement[] = [];
        for (let line of lines) {
          line = line.trim();

          if (!line) {
            continue;
          }

          const linkedText = parseLinkedText(line);
          if (linkedText.nodes.length === 1 && typeof linkedText.nodes[0] !== 'string') {
            const node = linkedText.nodes[0];
            lineElements.push(
              <div key={lineElements.length} title={node.title} className='button-container'>
                <Button disabled={disables[index] === false} onClick={() => openerService.open(node.href)}>
                  {renderLabelWithIcons(node.label)}
                </Button>
              </div>,
            );
          } else {
            const textNodes = linkedText.nodes.map((node, idx) => {
              if (typeof node === 'string') {
                return node;
              } else {
                return (
                  <a
                    key={idx}
                    className={clsx({ disabled: node.href.startsWith('command:') && disables[index] === false })}
                    title={node.title}
                    onClick={() => openerService.open(node.href)}
                  >
                    {node.label}
                  </a>
                );
              }
            });
            lineElements.push(<p key={lineElements.length}>{textNodes}</p>);
          }
        }
        return <React.Fragment key={index}>{lineElements}</React.Fragment>;
      })}
    </>
  );
};

interface WelcomeViewProps {
  viewId: string;
}

/**
 * Welcome view 不关心 viewState 变化
 */
function isWelcomeViewViewIdEqual(prevProps: WelcomeViewProps, nextProps: WelcomeViewProps) {
  return prevProps.viewId === nextProps.viewId;
}

export const WelcomeView: React.FC<WelcomeViewProps> = React.memo((props) => {
  const viewsController: ViewsController = useInjectable(ViewsController, [props.viewId]);
  const [contents, setContents] = React.useState<IViewContentDescriptor[]>(viewsController.contents);
  React.useEffect(() => {
    viewsController.onDidChange(() => {
      const newContents = viewsController.contents;
      setContents(newContents);
    });
  }, []);

  return contents.length ? (
    <div className={styles.welcome}>
      <WelcomeContent contents={contents} />
    </div>
  ) : null;
}, isWelcomeViewViewIdEqual);
