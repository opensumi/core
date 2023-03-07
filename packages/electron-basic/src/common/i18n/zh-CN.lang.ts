export const localizationBundle = {
  languageId: 'zh-CN',
  languageName: 'Chinese',
  localizedLanguageName: '中文(中国)',
  contents: {
    'window.title': [
      '基于活跃文件控制窗口标题。变量根据上下文替换：',
      '`${activeEditorShort}`: 活跃文件标题 (例如: myFile.txt).',
      '`${activeEditorMedium}`: 活跃文件相对工作区的路径 (例如: myFolder/myFileFolder/myFile.txt).',
      '`${activeEditorLong}`: 活跃文件的绝对路径 (例如: /Users/Development/myFolder/myFileFolder/myFile.txt).',
      '`${activeFolderShort}`: 活跃文件的父目录 (例如: myFileFolder).',
      '`${activeFolderMedium}`: 活跃文件的父目录相约对工作区的路径 (例如: myFolder/myFileFolder).',
      '`${activeFolderLong}`: 活跃文件的父目录相约对工作区的绝对路径 (例如: /Users/Development/myFolder/myFileFolder).',
      '`${folderName}`: 目录名称 (例如: myFolder).',
      '`${folderPath}`: 目录绝对路径 (例如: /Users/Development/myFolder).',
      '`${rootName}`: 工作区名称 (例如: myFolder or myWorkspace).',
      '`${rootPath}`: 工作区绝对路径 (例如: /Users/Development/myWorkspace).',
      '`${appName}`: 例如: OpenSumi.',
      '`${remoteName}`: 例如: SSH',
      '`${dirty}`: 有文件被修改的标记',
      '`${separator}`: 分隔符只在两边都有值的变量中出现',
    ].join('\n- '),
  },
};
