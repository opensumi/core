// 在monaco中注册settings.json文件为jsonc类型
monaco.languages.register({
  id: 'jsonc',
  'aliases': [
    'JSON with Comments',
  ],
  'filenames': [
    'settings.json',
  ],
});
