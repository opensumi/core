/**
 * 注册编辑器空白页背景图
 */
import {
  Domain,
  ComponentContribution,
  ComponentRegistry,
} from '@ali/ide-core-browser';
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
      <div>hello 大佬</div>
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
        list: ['上坡', '吭头', '柳千'],
      },
    });
  }
}
