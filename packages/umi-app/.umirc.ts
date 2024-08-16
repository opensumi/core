import path from 'path';
import { defineConfig } from 'umi';

export default defineConfig({
  routes: [
    { path: '/', component: 'index' },
    { path: '/docs', component: 'docs' },
  ],
  extraBabelPlugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-transform-flow-strip-types', { allowDeclareFields: true }],
    ['@babel/plugin-transform-class-properties', { loose: true }],
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    'babel-plugin-parameter-decorator',
  ],
  define: {
    'process.env.WORKSPACE_DIR': JSON.stringify(path.join(__dirname, '../../tools/workspace')),
    'process.env.EXTENSION_DIR': JSON.stringify(path.join(__dirname, '../../tools/extensions')),
  },
  npmClient: 'yarn',
  mfsu: false,
});
