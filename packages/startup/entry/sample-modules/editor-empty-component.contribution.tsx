/**
 * 注册编辑器空白页背景图
 */
import {
  Domain,
  ComponentContribution,
  ComponentRegistry,
} from '@ali/ide-core-browser';
import { Icon } from '@ali/ide-components';
import * as React from 'react';

const EditorEmptyComponent: React.FC<{
  list: string[],
}> = (props) => {
  return (
    <section style={{
      color: 'var(--foreground)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
      height: '100%',
      fontSize: 20,
    }}>
      <div>
        Hello IDE Framework
        <Icon icon='rundebug' />
      </div>
      <ul style={{margin: 0}}>
        {props.list.map((n) => <li key={n}>{n}</li>)}
      </ul>
      <div>
        Powered by{' '}
        <a href='http://gitlab.alibaba-inc.com/kaitian/ide-framework' target='_blank' rel='noreferrer'>
          Kaitian
        </a>
      </div>
    </section>
  );
};

@Domain(ComponentContribution)
export class EditorEmptyComponentContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry) {
    registry.register('editor-empty', {
      id: 'editor-empty',
      component: EditorEmptyComponent,
      initialProps: {
        list: ['Alibaba', 'Alipay'],
      },
    });
  }
}
