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
      <div style={{
        background: `url('./resources/kaitian-black.png') center center no-repeat`,
        height: 120,
        width: 120,
        backgroundSize: 120,
        opacity: 0.3,
      }}></div>
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
