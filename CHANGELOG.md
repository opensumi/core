# Changelog

> For some reason, in v2.x.y version, there may also be a Break Change in the x-bit.

## History

- [Previous Changelogs](https://github.com/opensumi/core/releases)
- [Previous Breaking Changes](https://github.com/opensumi/core/wiki/Breaking-Changes)

## v3.8.0

### What's New Features

- feat: terminal adds drag-and-drop by @lulusir in https://github.com/opensumi/core/pull/4300
- feat: improve terminal local link parser by @erha19 in https://github.com/opensumi/core/pull/4302
- feat: show inline input after cmd+K is triggered by @erha19 in https://github.com/opensumi/core/pull/4309
- feat: support search path on file dialog by @erha19 in https://github.com/opensumi/core/pull/4306
- feat: support property ThemeColor id by @quxingkai in https://github.com/opensumi/core/pull/4298
- feat: support typing code edits source by @Ricbet in https://github.com/opensumi/core/pull/4316
- feat: support diff & git uri preview of notebook file by @ensorrow in https://github.com/opensumi/core/pull/4323
- feat: line-change of code edits adds change parameter by @Ricbet in https://github.com/opensumi/core/pull/4329
- feat: add word link provider by @Aaaaash in https://github.com/opensumi/core/pull/4327
- feat: support polling watcher by @Aaaaash in https://github.com/opensumi/core/pull/4299
- feat: enhance file search service to handle absolute paths and update… by @Aaaaash in https://github.com/opensumi/core/pull/4334
- feat: add styles for dialog content and update file dialog logic by @erha19 in https://github.com/opensumi/core/pull/4337
- feat: support inline input restore by @Ricbet in https://github.com/opensumi/core/pull/4345
- feat: improve file delete confirmation message and styling by @erha19 in https://github.com/opensumi/core/pull/4333
- feat: support code edits keybinding by @Ricbet in https://github.com/opensumi/core/pull/4362
- feat: support fetching preference file after editor is saved by @erha19 in https://github.com/opensumi/core/pull/4365
- feat: support file dialog renderCustomMsg by @xujingli in https://github.com/opensumi/core/pull/4352
- feat: improve code edits source data by @Ricbet in https://github.com/opensumi/core/pull/4368
- feat: inline chat handler api adds selection parameter by @Ricbet in https://github.com/opensumi/core/pull/4366
- feat: make terminal draggable by @Marckon in https://github.com/opensumi/core/pull/4340
- feat: support copy relative path from link files by @erha19 in https://github.com/opensumi/core/pull/4367
- feat: improve line change code edits trigger rule by @Ricbet in https://github.com/opensumi/core/pull/4373
- refactor: upgrade monaco to 0.54.0 and support vscode.languages.registerInlineEditProvider API by @erha19 in https://github.com/opensumi/core/pull/4359
- feat: terminal search optimization by @Marckon in https://github.com/opensumi/core/pull/4384
- feat: support MCP server and client by @life2015 in https://github.com/opensumi/core/pull/4335
- feat: tabbar supports React.ReactNode for description by @wangxiaojuan in https://github.com/opensumi/core/pull/4386
- feat: send data by chunk in websocket by @bytemain in https://github.com/opensumi/core/pull/3988
- feat: support trigger source code edits by @Ricbet in https://github.com/opensumi/core/pull/4389
- feat: upgrade monaco core to 0.54.0-patch.2 by @erha19 in https://github.com/opensumi/core/pull/4391
- feat: support edit_file tool by @ensorrow in https://github.com/opensumi/core/pull/4385
- feat: add search file & content tool by @ensorrow in https://github.com/opensumi/core/pull/4396
- feat: support chat sessions management & recover from storage by @ensorrow in https://github.com/opensumi/core/pull/4399
- feat: add terminal command execution tool with user approval by @Aaaaash in https://github.com/opensumi/core/pull/4398
- feat: support maxInputTokens for agent by @ensorrow in https://github.com/opensumi/core/pull/4397
- feat: support NES render in code edits by @Ricbet in https://github.com/opensumi/core/pull/4403

### Refactor

- refactor: inline chat & input and support config by @Ricbet in https://github.com/opensumi/core/pull/4339
- refactor: inline diff data layer & render layer by @Ricbet in https://github.com/opensumi/core/pull/4353

### Style Changes

- fix: video preview style and static server by @Aaaaash in https://github.com/opensumi/core/pull/4324
- style: improve search panel popover content style by @erha19 in https://github.com/opensumi/core/pull/4342
- style: improve inline input decoration by @Ricbet in https://github.com/opensumi/core/pull/4343
- style: improve hover widget style by @erha19 in https://github.com/opensumi/core/pull/4390

### Other Changes

- fix(ai-native): use path.join for wasm file paths in WasmModuleManager by @nxps in https://github.com/opensumi/core/pull/4304
- fix: remove all unexpected errors by @erha19 in https://github.com/opensumi/core/pull/4307
- chore: revert incorrect prop name in Modal component by @erha19 in https://github.com/opensumi/core/pull/4311
- fix: debug toolbar is disappeared or session paused after debug session started by @erha19 in https://github.com/opensumi/core/pull/4312
- chore: outout channel append line type by @Aaaaash in https://github.com/opensumi/core/pull/4303
- Revert "chore: enable local worker file in development mode" by @Ricbet in https://github.com/opensumi/core/pull/4314
- fix: debug breakpoint paused and updated current session handling by @erha19 in https://github.com/opensumi/core/pull/4315
- docs: add codefuse ide to getting started by @hacke2 in https://github.com/opensumi/core/pull/4321
- chore: update default vscode engine version to 1.96.2 by @bk1012 in https://github.com/opensumi/core/pull/4320
- fix: retore files by order by @Aaaaash in https://github.com/opensumi/core/pull/4325
- fix: add method to check if doc is ignored by @erha19 in https://github.com/opensumi/core/pull/4341
- fix: display debug hover view with correct size config by @erha19 in https://github.com/opensumi/core/pull/4338
- fix: interactive input handle api adds selection parameter by @Ricbet in https://github.com/opensumi/core/pull/4346
- fix: always dispose debug unexpected widget in the end by @erha19 in https://github.com/opensumi/core/pull/4349
- fix: watcher dispose logic by @Aaaaash in https://github.com/opensumi/core/pull/4355
- fix: adjust default sizes for top slot and menubar height by @erha19 in https://github.com/opensumi/core/pull/4356
- fix: add default file name handling for save dialog by @erha19 in https://github.com/opensumi/core/pull/4357
- fix: getDefaultPath add model param by @xujingli in https://github.com/opensumi/core/pull/4372
- fix: normalize content type by converting file extension to lowercase by @Aaaaash in https://github.com/opensumi/core/pull/4375
- chore: update to the latest diff package by @ensorrow in https://github.com/opensumi/core/pull/4376
- fix: notebook diff monaco upgrade issue by @ensorrow in https://github.com/opensumi/core/pull/4379
- chore(release): release v3.7.1 by @Ricbet in https://github.com/opensumi/core/pull/4380
- fix: tabbar supports React.ReactNode for description by @wangxiaojuan in https://github.com/opensumi/core/pull/4388
- chore: add missing InlineEdit export by @erha19 in https://github.com/opensumi/core/pull/4393
- chore: improve llm context by @Aaaaash in https://github.com/opensumi/core/pull/4394
- fix: add default context prompt provider by @Aaaaash in https://github.com/opensumi/core/pull/4395
- fix: add delay for disposing inline edit adapter to prevent rejection by @erha19 in https://github.com/opensumi/core/pull/4400
- fix: reduce font size in chat components and update MCP tools localiz… by @Aaaaash in https://github.com/opensumi/core/pull/4401

## New Contributors

- @lulusir made their first contribution in https://github.com/opensumi/core/pull/4300
- @xujingli made their first contribution in https://github.com/opensumi/core/pull/4352
- @Marckon made their first contribution in https://github.com/opensumi/core/pull/4340

**Full Changelog**: https://github.com/opensumi/core/compare/v3.7.1...v3.8.0

## v3.7.0

### What's New Features

- feat: support VSCode API TreeView.badge by @zhiyudangchu in https://github.com/opensumi/core/pull/4185
- feat: partially supported the VSCode TerminalExitReason API by @life2015 in https://github.com/opensumi/core/pull/4195
- feat: empty implement treeview support treeItem.checkboxstate by @zhiyudangchu in https://github.com/opensumi/core/pull/4198
- feat: remove alipay cloudrun marketplace by @bk1012 in https://github.com/opensumi/core/pull/4200
- feat: empty impl VSCode TestCoverage API by @bk1012 in https://github.com/opensumi/core/pull/4206
- feat: empty impl VSCode TerminalShellIntegration API by @bk1012 in https://github.com/opensumi/core/pull/4210
- feat: fix git branch input box flashing by @bk1012 in https://github.com/opensumi/core/pull/4190
- feat: support VSCode API: DocumentDropEdit by @bk1012 in https://github.com/opensumi/core/pull/4213
- feat: support TestRunProfile.onDidChangeDefault by @bk1012 in https://github.com/opensumi/core/pull/4215
- feat: support treeview treeItem.checkboxstate by @zhiyudangchu in https://github.com/opensumi/core/pull/4214
- feat: support VSCode API: TextEditorLineNumbersStyle.Interval by @bk1012 in https://github.com/opensumi/core/pull/4216
- feat: support VSCode API: env.onDidChangeShell by @bk1012 in https://github.com/opensumi/core/pull/4223
- feat: support VSCode API: AuthenticationGetSessionOptions.account by @hui2334387208 in https://github.com/opensumi/core/pull/4224
- feat: empty impl VSCode DebugThread and DebugStackFrame debug by @quxingkai in https://github.com/opensumi/core/pull/4225
- feat: support VSCode API: createTelemetryLogger.logUsage、createTeleme… by @hui2334387208 in https://github.com/opensumi/core/pull/4226
- feat: update vscode engine version to 1.88.1 by @bk1012 in https://github.com/opensumi/core/pull/4199
- feat: empty impl VSCode TestRunRequest.preserveFocus API by @hui2334387208 in https://github.com/opensumi/core/pull/4232
- feat: support VSCode API: WindowState.active by @quxingkai in https://github.com/opensumi/core/pull/4233
- feat: update default extension by @bk1012 in https://github.com/opensumi/core/pull/4246
- feat: support VSCode API: TestMessage.stackTrace by @hui2334387208 in https://github.com/opensumi/core/pull/4247
- feat: update vscode engine to 1.94.2 by @bk1012 in https://github.com/opensumi/core/pull/4248
- chore: update comments、language、tests extension type by @hui2334387208 in https://github.com/opensumi/core/pull/4257
- feat: support editor action arguments by @hacke2 in https://github.com/opensumi/core/pull/4254
- feat: improve file drop to upload ux by @erha19 in https://github.com/opensumi/core/pull/4260
- feat: support toggle column selection by @hacke2 in https://github.com/opensumi/core/pull/4265
- feat: design menubar toolbar actions by @Ricbet in https://github.com/opensumi/core/pull/4268
- feat: support activeEditorIsDirty contextKey by @Aaaaash in https://github.com/opensumi/core/pull/4276
- feat: update rc dependencies version by @quxingkai in https://github.com/opensumi/core/pull/4288
- feat: support VSCode API: Workspace.save and Workspace.saveAs by @hui2334387208 in https://github.com/opensumi/core/pull/4277
- chore: update SnippetString.appendChoice param by @hui2334387208 in https://github.com/opensumi/core/pull/4293
- feat: improve inlineChat and inlineEditInput UX by @erha19 in https://github.com/opensumi/core/pull/4291
- feat: Define the exported IconPath type by @quxingkai in https://github.com/opensumi/core/pull/4297
- chore: update WebviewPortMapping and proposed type by @hui2334387208 in https://github.com/opensumi/core/pull/4295

### Refactor

- refactor: run file watcher in child process by @Aaaaash in https://github.com/opensumi/core/pull/4202
- refactor: upgrade monaco 0.53.0-dev by @Ricbet in https://github.com/opensumi/core/pull/4227

### Style Changes

- style: improve editor context menu style by @erha19 in https://github.com/opensumi/core/pull/4261
- style: improve inline diff partial edit by @Ricbet in https://github.com/opensumi/core/pull/4255
- style: prettify output log by @Ricbet in https://github.com/opensumi/core/pull/4263

### Other Changes

- chore(release): release v3.6.1 by @Ricbet in https://github.com/opensumi/core/pull/4207
- fix: rename log service dispose by @winjo in https://github.com/opensumi/core/pull/4212
- fix: update light theme by @wangxiaojuan in https://github.com/opensumi/core/pull/4229
- fix: desing menubar order default by @winjo in https://github.com/opensumi/core/pull/4231
- chore(deps): bump nanoid from 3.3.4 to 3.3.8 by @dependabot in https://github.com/opensumi/core/pull/4209
- chore(release): release v3.6.2 by @Ricbet in https://github.com/opensumi/core/pull/4239
- chore(release): release v3.6.3 by @Ricbet in https://github.com/opensumi/core/pull/4244
- fix: pseudoterminal issue by @Aaaaash in https://github.com/opensumi/core/pull/4242
- chore(release): release v3.6.4 by @Ricbet in https://github.com/opensumi/core/pull/4256
- fix: debug stop render by @Ricbet in https://github.com/opensumi/core/pull/4264
- fix: adjust the scope of the diffEditor.hideUnchangedRegions.enabled configuration to the user level by @hacke2 in https://github.com/opensumi/core/pull/4270
- fix: fire quick pick accept after selection event by @ensorrow in https://github.com/opensumi/core/pull/4267
- fix: intelligent completion render unusual by @Ricbet in https://github.com/opensumi/core/pull/4280
- fix: provide default watch host by @hacke2 in https://github.com/opensumi/core/pull/4284
- chore: enable local worker file in development mode by @Ricbet in https://github.com/opensumi/core/pull/4273
- fix: quickopen auto focus previous active element by @hacke2 in https://github.com/opensumi/core/pull/4272
- fix: add context check for debug mode by @erha19 in https://github.com/opensumi/core/pull/4275
- chore: remove codeedits line change limit by @Ricbet in https://github.com/opensumi/core/pull/4294
- fix: ai layout right tabbar render by @Ricbet in https://github.com/opensumi/core/pull/4290
- fix: tabbar dnd invalid by @Ricbet in https://github.com/opensumi/core/pull/4296

## New Contributors

- @zhiyudangchu made their first contribution in https://github.com/opensumi/core/pull/4185
- @hui2334387208 made their first contribution in https://github.com/opensumi/core/pull/4224
- @quxingkai made their first contribution in https://github.com/opensumi/core/pull/4225

**Full Changelog**: https://github.com/opensumi/core/compare/v3.6.4...v3.7.0

## v3.6.0

### What's New Features

- feat: add support for VSCode API: TextEditorOptions.indentSize by @bk1012 in https://github.com/opensumi/core/pull/4146
- feat: support VSCode API: inputBox.valueSelection by @bk1012 in https://github.com/opensumi/core/pull/4145
- feat: add code edits perferences by @Ricbet in https://github.com/opensumi/core/pull/4155
- feat: empty implement testing 1.84 api by @Ricbet in https://github.com/opensumi/core/pull/4167
- feat: add notebook by @zhanba in https://github.com/opensumi/core/pull/3945
- feat: support VSCode API: SnippetTextEdit by @bk1012 in https://github.com/opensumi/core/pull/4154
- feat: support VSCode API: TaskPresentationOptions by @bk1012 in https://github.com/opensumi/core/pull/4137
- feat: support VSCode API: EnvironmentVariableMutator.option by @bk1012 in https://github.com/opensumi/core/pull/4169
- feat: empty implement VSCode proposed API: registerMultiDocumentHighlightProvider by @bk1012 in https://github.com/opensumi/core/pull/4172
- feat：support VSCode API: GlobalEnvironmentVariableCollectoin by @bk1012 in https://github.com/opensumi/core/pull/4171
- feat: empty implement VSCode API: DebugSessionOptions by @bk1012 in https://github.com/opensumi/core/pull/4184
- fix: when using language pack extensions, extensions that use i10n do not load correctly by @xkaede in https://github.com/opensumi/core/pull/4181
- feat: add notebook variable inspector panel by @ensorrow in https://github.com/opensumi/core/pull/4186
- chore(deps): bump codecov/codecov-action from 4 to 5 by @dependabot in https://github.com/opensumi/core/pull/4175

### Refactor

- refactor: remove mobx by @Ricbet in https://github.com/opensumi/core/pull/4131

### Other Changes

- chore(release): release v3.5.0 by @Ricbet in https://github.com/opensumi/core/pull/4144
- fix: code edits reporter code by @Ricbet in https://github.com/opensumi/core/pull/4153
- fix: quick pick update options by @Ricbet in https://github.com/opensumi/core/pull/4163
- fix: use modified uri handling for diff editor by @erha19 in https://github.com/opensumi/core/pull/4150
- fix: correct width calculation in resize component by @erha19 in https://github.com/opensumi/core/pull/4170
- fix: support ensure save file dialog by enter keyboard event by @erha19 in https://github.com/opensumi/core/pull/4165
- chore: revert vscode engine version by @bk1012 in https://github.com/opensumi/core/pull/4173
- fix: right panel container view by @Ricbet in https://github.com/opensumi/core/pull/4178
- chore(deps-dev): bump webpack-bundle-analyzer from 4.10.1 to 4.10.2 by @dependabot in https://github.com/opensumi/core/pull/4176
- chore(deps-dev): bump @types/react-mentions from 4.1.13 to 4.4.0 by @dependabot in https://github.com/opensumi/core/pull/4090
- chore(deps): bump cross-spawn from 6.0.5 to 6.0.6 in /tools/electron by @dependabot in https://github.com/opensumi/core/pull/4179
- fix: when context key cause different menu bars change at same time. only one menu bar refreshed by @xkaede in https://github.com/opensumi/core/pull/4182
- fix: restored notebook have invalid keybinding by @zhanba in https://github.com/opensumi/core/pull/4174
- fix: terminal open link on changed cwd by @zhanba in https://github.com/opensumi/core/pull/4188

**Full Changelog**: https://github.com/opensumi/core/compare/v3.5.0...v3.6.0

## v3.5.0

### What's New Features

- chore(deps): bump express from 4.18.3 to 4.21.0 by @dependabot in https://github.com/opensumi/core/pull/4034
- feat(inline-diff): support hide accpet widget by @bytemain in https://github.com/opensumi/core/pull/4066
- feat(iframe): support load webview by srcdoc by @bytemain in https://github.com/opensumi/core/pull/4071
- feat: enhance data store by @bytemain in https://github.com/opensumi/core/pull/4081
- chore(deps-dev): bump @commitlint/cli from 19.2.2 to 19.5.0 by @dependabot in https://github.com/opensumi/core/pull/4057
- feat(ext): support `sumiContributesOverride` field by @bytemain in https://github.com/opensumi/core/pull/4092
- feat: improve ghost text render by @Ricbet in https://github.com/opensumi/core/pull/4102
- feat: implement line change code edits api by @Ricbet in https://github.com/opensumi/core/pull/4106
- feat: add option to render removed widget immediately by @bytemain in https://github.com/opensumi/core/pull/4113
- feat: support VSCode API: provideDocumentRangesFormattingEdits by @bk1012 in https://github.com/opensumi/core/pull/4116
- feat: support AuthenticationForceNewSessionOptions by @bk1012 in https://github.com/opensumi/core/pull/4115
- feat: add code edits api reporter by @Ricbet in https://github.com/opensumi/core/pull/4118
- feat: support AutoClosingPair by @bk1012 in https://github.com/opensumi/core/pull/4117
- feat: support WorkspaceEditMetadata by @bk1012 in https://github.com/opensumi/core/pull/4120
- feat: add zsh integration support by @life2015 in https://github.com/opensumi/core/pull/4130
- feat: support QuickPickItem.iconPath by @bk1012 in https://github.com/opensumi/core/pull/4134
- feat: Implementing an Empty Function for registerDocumentDropEditProvider and registerDocumentPasteEditProvider by @bk1012 in https://github.com/opensumi/core/pull/4136
- feat: support MessageOptions.detail by @bk1012 in https://github.com/opensumi/core/pull/4135

### Refactor

- refactor: intelligent completion & implement code edits api by @Ricbet in https://github.com/opensumi/core/pull/4105

### Style Changes

- style: editor tab design style by @Ricbet in https://github.com/opensumi/core/pull/4099
- style: beautify suggest style by @Ricbet in https://github.com/opensumi/core/pull/4101
- style: improve notice toast style by @erha19 in https://github.com/opensumi/core/pull/4142
- style: improve notification buttons style by @erha19 in https://github.com/opensumi/core/pull/4141
- style: improve statusbar popover style by @erha19 in https://github.com/opensumi/core/pull/4140

### Other Changes

- chore(release): release v3.4.1 by @bytemain in https://github.com/opensumi/core/pull/4056
- fix: build error in node16 by @zhanba in https://github.com/opensumi/core/pull/4069
- chore: update xterm imports to use @xterm/xterm package (#4036) by @nxps in https://github.com/opensumi/core/pull/4068
- fix(inline-diff): fix error in calculating lines of code change by @bytemain in https://github.com/opensumi/core/pull/4074
- chore: add missing ajv dep for keymaps package by @MMhunter in https://github.com/opensumi/core/pull/4072
- chore(release): release v3.4.3 by @Ricbet in https://github.com/opensumi/core/pull/4082
- fix: incorrect actionType in data reporting by @wangxiaojuan in https://github.com/opensumi/core/pull/4084
- chore(ext-service): remove unused method by @bytemain in https://github.com/opensumi/core/pull/4086
- fix(inline-diff): fix cannot listen partial accept event by @bytemain in https://github.com/opensumi/core/pull/4088
- chore: use tiktoken instead of js-tiktoken by @Aaaaash in https://github.com/opensumi/core/pull/4094
- chore(release): release v3.4.4 by @Ricbet in https://github.com/opensumi/core/pull/4097
- fix: improve inline diff widget render by @Ricbet in https://github.com/opensumi/core/pull/4100
- fix: rewrite content minimum width by @Ricbet in https://github.com/opensumi/core/pull/4103
- fix: diff editor model not exist error by @erha19 in https://github.com/opensumi/core/pull/4109
- chore: improve code edits source trigger by @Ricbet in https://github.com/opensumi/core/pull/4114
- chore: add extract code utils by @Ricbet in https://github.com/opensumi/core/pull/4123
- fix: markdown html link render error by @Ricbet in https://github.com/opensumi/core/pull/4119
- fix: diff computer null reference errors by @Ricbet in https://github.com/opensumi/core/pull/4125
- chore(deps): bump http-proxy-middleware from 2.0.6 to 2.0.7 by @dependabot in https://github.com/opensumi/core/pull/4124
- chore(release): release v3.4.5 by @Ricbet in https://github.com/opensumi/core/pull/4132
- chore(deps): bump elliptic from 6.5.7 to 6.6.0 by @dependabot in https://github.com/opensumi/core/pull/4133
- chore(deps): bump koa from 2.15.0 to 2.15.3 by @dependabot in https://github.com/opensumi/core/pull/4128
- fix: open recent workspace in web by @weiwen111 in https://github.com/opensumi/core/pull/4139
- fix: tiktoken dependencies build error by @Ricbet in https://github.com/opensumi/core/pull/4143

## New Contributors

- @nxps made their first contribution in https://github.com/opensumi/core/pull/4068
- @weiwen111 made their first contribution in https://github.com/opensumi/core/pull/4139

**Full Changelog**: https://github.com/opensumi/core/compare/v3.4.5...v3.5.0

## v3.4.0

### What's New Features

- feat: add notebook extension api by @zhanba in https://github.com/opensumi/core/pull/3963
- feat: support using editor AI in notebook by @zhanba in https://github.com/opensumi/core/pull/4006
- feat: support problem fix api by @Ricbet in https://github.com/opensumi/core/pull/3999
- feat: support inline chat proposed extension api by @Ricbet in https://github.com/opensumi/core/pull/3936
- fix: ai feature support multiple instances by @Ricbet in https://github.com/opensumi/core/pull/4027
- refactor: ai feature binding editor lifecycle by @Ricbet in https://github.com/opensumi/core/pull/4033
- feat: support extension register panel to ai chat by @bytemain in https://github.com/opensumi/core/pull/4012
- feat: use async in watch file changes by @bytemain in https://github.com/opensumi/core/pull/4026
- feat: support intelligent completions always visible by @Ricbet in https://github.com/opensumi/core/pull/4039
- feat: supports ai history relative feature by @MMhunter in https://github.com/opensumi/core/pull/3989
- feat: support intelligent completions always visible preference by @Ricbet in https://github.com/opensumi/core/pull/4043
- feat: revert an API that will be removed in a future version of VSCode by @bk1012 in https://github.com/opensumi/core/pull/4044
- feat: upgrade inline completion extension api by @Ricbet in https://github.com/opensumi/core/pull/4047
- feat: support detect EOL from file content by @erha19 in https://github.com/opensumi/core/pull/4045
- feat: introduce new remote service by @bytemain in https://github.com/opensumi/core/pull/4037
- feat: compatibility with the experimental API registerEditSessionIdentityProvider by @bk1012 in https://github.com/opensumi/core/pull/4049

### Style Changes

- style: design light selected background color by @Ricbet in https://github.com/opensumi/core/pull/4016
- style: improve quickpick item style by @erha19 in https://github.com/opensumi/core/pull/4020

### Other Changes

- fix: inline chat controller timing by @Ricbet in https://github.com/opensumi/core/pull/4010
- fix: inline chat first line overflow visible by @Ricbet in https://github.com/opensumi/core/pull/4011
- chore: fix typos by @co63oc in https://github.com/opensumi/core/pull/4013
- fix: store diff editor state while docs not destory by @erha19 in https://github.com/opensumi/core/pull/4015
- fix: fire properties change on time by @bytemain in https://github.com/opensumi/core/pull/4014
- fix: platform detect logic by @erha19 in https://github.com/opensumi/core/pull/4021
- fix: remove global from browser by @bytemain in https://github.com/opensumi/core/pull/4022
- fix: direct debug adapter fix, and runInTerminal fix by @life2015 in https://github.com/opensumi/core/pull/4031
- fix: layout state restore not work by @bytemain in https://github.com/opensumi/core/pull/3941
- fix: avoid rpc proxy leak by @bytemain in https://github.com/opensumi/core/pull/4042

## New Contributors

- @co63oc made their first contribution in https://github.com/opensumi/core/pull/4013

**Full Changelog**: https://github.com/opensumi/core/compare/v3.3.3...v3.4.0

## v3.3.0

### What's New Features

- feat: support register tabbar right component by @bytemain in https://github.com/opensumi/core/pull/3907
- feat: support change editor tabbar height by @bytemain in https://github.com/opensumi/core/pull/3920
- feat: support configure inline diff style by @bytemain in https://github.com/opensumi/core/pull/3924
- feat: add 'clear result' button to search panel by @Souls-R in https://github.com/opensumi/core/pull/3906
- feat: chat slash command support isShortcut by @Ricbet in https://github.com/opensumi/core/pull/3929
- feat(enhance-icon): add accessibility support by @lilangtop in https://github.com/opensumi/core/pull/3926
- feat(ai-native): improve accessibility support by @lilangtop in https://github.com/opensumi/core/pull/3937
- feat: support multi inline completion by @Ricbet in https://github.com/opensumi/core/pull/3874
- feat: support register external ext api by @hacke2 in https://github.com/opensumi/core/pull/3933
- feat: support multi-line edits rewrite widget by @Ricbet in https://github.com/opensumi/core/pull/3962
- feat: support configure ext host spawn options by @bytemain in https://github.com/opensumi/core/pull/3980
- feat(inline-diff): adjust data calculation for changed lines by @bytemain in https://github.com/opensumi/core/pull/3983
- feat: avoid layouts thrashing by @bytemain in https://github.com/opensumi/core/pull/3764

### Refactor

- refactor: inline diff previewer snapshot by @Ricbet in https://github.com/opensumi/core/pull/3919
- refactor: optimize editor tabbar scroll by @bytemain in https://github.com/opensumi/core/pull/3953
- refactor: organize dependencies by @bytemain in https://github.com/opensumi/core/pull/3977

### Style Changes

- fix: edit tab scrollbar style problem by @bytemain in https://github.com/opensumi/core/pull/3899
- fix: update scrollbar component style by @bytemain in https://github.com/opensumi/core/pull/3909
- fix: update scrollbar component style by @bytemain in https://github.com/opensumi/core/pull/3917
- style: fix editor tabbar style by @bytemain in https://github.com/opensumi/core/pull/3967
- style: fix editor tab style by @bytemain in https://github.com/opensumi/core/pull/3970

### Other Changes

- fix: hide bottom tab panel if no container by @bytemain in https://github.com/opensumi/core/pull/3925
- fix: rjsf version is inconsistent by @bytemain in https://github.com/opensumi/core/pull/3934
- fix: capturer not work in web worker by @bytemain in https://github.com/opensumi/core/pull/3935
- fix: inline input allow editor overflow by @Ricbet in https://github.com/opensumi/core/pull/3944
- fix: improve inline chat position calculate by @Ricbet in https://github.com/opensumi/core/pull/3942
- fix: electron reload not work by @winjo in https://github.com/opensumi/core/pull/3958
- fix: add keyboard focus and accessibility support for editor tabs and close buttons by @lilangtop in https://github.com/opensumi/core/pull/3957
- fix: right panel has two resize handle by @bytemain in https://github.com/opensumi/core/pull/3960
- fix: inline chat indent by @Ricbet in https://github.com/opensumi/core/pull/3961
- fix: document status may out of sync by @bytemain in https://github.com/opensumi/core/pull/3954
- fix: model leak by @bytemain in https://github.com/opensumi/core/pull/3969
- fix: listen previewer when change by @bytemain in https://github.com/opensumi/core/pull/3972
- fix: set \_currentScope when update tabList in constructor by @winjo in https://github.com/opensumi/core/pull/3979
- fix: event driven state by @winjo in https://github.com/opensumi/core/pull/3978

## New Contributors

- @Souls-R made their first contribution in https://github.com/opensumi/core/pull/3906
- @lilangtop made their first contribution in https://github.com/opensumi/core/pull/3926

**Full Changelog**: https://github.com/opensumi/core/compare/v3.2.5...v3.3.0

## v3.2.0

### What's New Features

- feat: optimize tree performance by @bytemain in https://github.com/opensumi/core/pull/3742
- feat: avoid send too many log request by @bytemain in https://github.com/opensumi/core/pull/3767
- feat: support inline chat on empty lines by @Ricbet in https://github.com/opensumi/core/pull/3762
- chore(deps): bump braces from 3.0.2 to 3.0.3 by @dependabot in https://github.com/opensumi/core/pull/3776
- Revert "feat: optimize tree performance" by @bytemain in https://github.com/opensumi/core/pull/3783
- chore(deps): bump braces from 3.0.2 to 3.0.3 in /tools/electron by @dependabot in https://github.com/opensumi/core/pull/3777
- feat: prevent accidentally opening binary file by @bytemain in https://github.com/opensumi/core/pull/3772
- feat: optimize merge conflicts by @bytemain in https://github.com/opensumi/core/pull/3787
- feat: support show inline chat on diff editor by @erha19 in https://github.com/opensumi/core/pull/3774
- feat: inline diff supports live preview mode by @Ricbet in https://github.com/opensumi/core/pull/3798
- feat: support partial edit widget by @Ricbet in https://github.com/opensumi/core/pull/3814
- feat: add autoApplyNonConflictChanges configuration by @Ricbet in https://github.com/opensumi/core/pull/3829
- feat: support live inline diff undo/redo edit by @Ricbet in https://github.com/opensumi/core/pull/3823
- feat(editor-collection): add getEditorByUri method by @bytemain in https://github.com/opensumi/core/pull/3840
- feat: support disable restore editor group state by @bytemain in https://github.com/opensumi/core/pull/3838
- feat: request completion support workspaceDir by @bytemain in https://github.com/opensumi/core/pull/3833
- chore(deps): bump mini-css-extract-plugin from 2.8.1 to 2.9.0 by @dependabot in https://github.com/opensumi/core/pull/3662
- feat: optimize inline diff viewer by @bytemain in https://github.com/opensumi/core/pull/3836
- chore(deps): bump koa-router from 10.1.1 to 12.0.1 by @dependabot in https://github.com/opensumi/core/pull/3663
- feat(editor): add a preference prevent scroll after get focused by @bytemain in https://github.com/opensumi/core/pull/3846
- feat(inline-diff): support serialize state by @bytemain in https://github.com/opensumi/core/pull/3855
- feat: support 3-way change encoding by @Ricbet in https://github.com/opensumi/core/pull/3851
- feat: control whether previewer to dispose when editor closed by @bytemain in https://github.com/opensumi/core/pull/3888
- chore(deps): bump @rjsf/validator-ajv6 from 5.4.0 to 5.19.4 by @dependabot in https://github.com/opensumi/core/pull/3893
- feat: support rate edit controller by @Ricbet in https://github.com/opensumi/core/pull/3896

### Refactor

- refactor(ai-native): optimize monaco contrib registration by @bytemain in https://github.com/opensumi/core/pull/3763
- refactor: optimize the logic of inline widget display by @Ricbet in https://github.com/opensumi/core/pull/3885

### Style Changes

- style: add border-radius to scrollbar thumbs by @erha19 in https://github.com/opensumi/core/pull/3752
- style: adjust tabbar close popover styles by @erha19 in https://github.com/opensumi/core/pull/3749
- style: improve action widget styles by @Ricbet in https://github.com/opensumi/core/pull/3748
- style: adjust status bar colors for default and light themes by @erha19 in https://github.com/opensumi/core/pull/3756
- style: add box-sizing and border-radius properties by @erha19 in https://github.com/opensumi/core/pull/3759
- style: adjust title actions style by @erha19 in https://github.com/opensumi/core/pull/3765
- style: adjust z-index values for layout components by @erha19 in https://github.com/opensumi/core/pull/3769
- style: add styles for markdown popover and icons by @erha19 in https://github.com/opensumi/core/pull/3766
- style: remove unnecessary overflow:hidden from menubar in global style by @erha19 in https://github.com/opensumi/core/pull/3768
- style: improve SCM action button style by @erha19 in https://github.com/opensumi/core/pull/3788
- style: inline-hint line height by @Ricbet in https://github.com/opensumi/core/pull/3826
- style: remove useless styles by @Ricbet in https://github.com/opensumi/core/pull/3854
- style: inline diff removed widget style by @Ricbet in https://github.com/opensumi/core/pull/3868
- style: improve inline diff partial style by @Ricbet in https://github.com/opensumi/core/pull/3877
- style: improve light theme editor style by @Ricbet in https://github.com/opensumi/core/pull/3884

### Other Changes

- chore(release): v3.1.0 by @Ricbet in https://github.com/opensumi/core/pull/3745
- docs: add v3.1.0 changelog by @Ricbet in https://github.com/opensumi/core/pull/3746
- fix: adjust zone widget width for scrollbar by @erha19 in https://github.com/opensumi/core/pull/3750
- fix: validate copy and move operations by @bytemain in https://github.com/opensumi/core/pull/3754
- fix: conditionally show HorizontalVertical component based on visible by @erha19 in https://github.com/opensumi/core/pull/3757
- fix: update default editor background color to #181818 by @erha19 in https://github.com/opensumi/core/pull/3760
- fix: correct uri equality check with comments service by @erha19 in https://github.com/opensumi/core/pull/3755
- fix: improve handling extra menu nodes on left tabbar by @erha19 in https://github.com/opensumi/core/pull/3771
- chore(release): release v3.1.1 by @bytemain in https://github.com/opensumi/core/pull/3775
- fix: server's incorrect dispose of service center by @bytemain in https://github.com/opensumi/core/pull/3785
- chore(deps): bump file-type from 16.5.3 to 16.5.4 by @dependabot in https://github.com/opensumi/core/pull/3790
- chore(deps): bump ws from 8.16.0 to 8.17.1 by @dependabot in https://github.com/opensumi/core/pull/3786
- chore(release): release v3.1.2 by @bytemain in https://github.com/opensumi/core/pull/3795
- fix(merge-editor): some scm provider cannot switch to text editor by @bytemain in https://github.com/opensumi/core/pull/3799
- fix: skip locked panels during resize check by @erha19 in https://github.com/opensumi/core/pull/3797
- chore(release): release v3.1.3 by @bytemain in https://github.com/opensumi/core/pull/3807
- fix: inline chat code blocks controller by @Ricbet in https://github.com/opensumi/core/pull/3809
- fix: inline live diff zone range by @Ricbet in https://github.com/opensumi/core/pull/3810
- chore(deps): bump xterm-addon-fit from 0.7.0 to 0.8.0 by @dependabot in https://github.com/opensumi/core/pull/3818
- chore(release): release v3.1.4 by @Ricbet in https://github.com/opensumi/core/pull/3821
- fix: skip locked panels during resize check by @erha19 in https://github.com/opensumi/core/pull/3801
- fix: add intersection observer for resize detection by @erha19 in https://github.com/opensumi/core/pull/3819
- fix: will watch same folder multiple times by @bytemain in https://github.com/opensumi/core/pull/3831
- fix: improve chat reporter by @Ricbet in https://github.com/opensumi/core/pull/3832
- fix: ai native left panel supports large size by @wangxiaojuan in https://github.com/opensumi/core/pull/3828
- fix: copy/paste in symbolic file by @zhanba in https://github.com/opensumi/core/pull/3827
- fix: improve live inline diff prioritization and fix discard functionality by @Ricbet in https://github.com/opensumi/core/pull/3837
- fix: add pty socket timeout by @winjo in https://github.com/opensumi/core/pull/3834
- fix: textmate service is not compatible with monaco 0.47 by @bytemain in https://github.com/opensumi/core/pull/3847
- chore(deps): bump v8-inspect-profiler from 0.0.20 to 0.1.1 by @dependabot in https://github.com/opensumi/core/pull/3665
- fix: enable multi-root workspace support by @zhanba in https://github.com/opensumi/core/pull/3848
- fix: open folder on web by @zhanba in https://github.com/opensumi/core/pull/3863
- fix: debug console readonly status by @Ricbet in https://github.com/opensumi/core/pull/3852
- chore(deps): bump nsfw from 2.2.0 to 2.2.4 by @dependabot in https://github.com/opensumi/core/pull/3859
- fix: overlap between inline hint and gitlens by @Ricbet in https://github.com/opensumi/core/pull/3870
- fix: not restore diff editor state by @erha19 in https://github.com/opensumi/core/pull/3850
- fix: check potential null by @bytemain in https://github.com/opensumi/core/pull/3872
- fix: left tabbar item cannot drag by @bytemain in https://github.com/opensumi/core/pull/3873
- fix: inline input edit operations by @Ricbet in https://github.com/opensumi/core/pull/3876
- chore: improve inline stream diff render by @Ricbet in https://github.com/opensumi/core/pull/3881
- fix(inline-diff): remove-widget at first line cannot be dismissed by @bytemain in https://github.com/opensumi/core/pull/3882
- chore: improve inline chat content visible by @Ricbet in https://github.com/opensumi/core/pull/3883
- fix: avoid multi ServerApp instance share one path handler by @bytemain in https://github.com/opensumi/core/pull/3887
- fix: add workspace context by @zhanba in https://github.com/opensumi/core/pull/3890
- chore: improve inline diff indent by @Ricbet in https://github.com/opensumi/core/pull/3894
- fix: inline chat shortcut display by @Ricbet in https://github.com/opensumi/core/pull/3897
- fix: memory leak by @bytemain in https://github.com/opensumi/core/pull/3898
- fix: render tabbar correctly on initial load by @erha19 in https://github.com/opensumi/core/pull/3895

**Full Changelog**: https://github.com/opensumi/core/compare/v3.1.4...v3.2.0

## v3.1.0

### What's New Features

- feat: support diff editor widget readable stream by @Ricbet in https://github.com/opensumi/core/pull/3710
- feat: support interactive input run strategy by @Ricbet in https://github.com/opensumi/core/pull/3735
- feat: add preference to controller whether enable prompt engineering by @bytemain in https://github.com/opensumi/core/pull/3740
- feat: update preference service typing by @bk1012 in https://github.com/opensumi/core/pull/3741
- feat: support multiline comment by @erha19 in https://github.com/opensumi/core/pull/3719
- feat: add rpc timing event track by @bytemain in https://github.com/opensumi/core/pull/3743

### Refactor

- refactor: code action register by @Ricbet in https://github.com/opensumi/core/pull/3722
- refactor: channel can use custom serializer by @bytemain in https://github.com/opensumi/core/pull/3711
- refactor: split ai editor feature capabilities by @Ricbet in https://github.com/opensumi/core/pull/3716

### Bug fixes

- fix: design module no register top layout by @Ricbet in https://github.com/opensumi/core/pull/3723
- fix: should not change user defined ai capabilities by @bytemain in https://github.com/opensumi/core/pull/3738
- fix: inline chat controller code block by @Ricbet in https://github.com/opensumi/core/pull/3739
- fix: inline diff widget layout by @Ricbet in https://github.com/opensumi/core/pull/3744

<a name="breaking_changes_3.1.0">[Breaking Changes:](#breaking_changes_3.1.0)</a>

#### 1. about `useMenubarView` configuration

Now the `useMenubarView` configuration has been moved to the `designLayout` configuration, please change it in time.

```typescript
/**
 * AI Native Config
 */
AINativeConfig?: IAINativeConfig;
/**
 * OpenSumi Design Config
 */
designLayout?: IDesignLayoutConfig;
```

When the useMenubarView configuration is enabled, you also need to register the layoutConfig configuration of `SlotLocation.top`

```diff
+ import { DESIGN_MENUBAR_CONTAINER_VIEW_ID } from '@opensumi/ide-design';

+layoutConfig: {
+  ...
+  [SlotLocation.top]: {
+    modules: [DESIGN_MENUBAR_CONTAINER_VIEW_ID],
+  }
+}
```

## v3.0.0

### What's New Features

- feat: achieve noRecursive fileWatcher by @wjywy in https://github.com/opensumi/core/pull/3095
- feat: add enable persistent terminal session preference by @Aaaaash in https://github.com/opensumi/core/pull/3127
- feat: implement workspaceEdit needConfirmation by @hacke2 in https://github.com/opensumi/core/pull/3122
- feat: merged nsfw event by @pipiiiiii in https://github.com/opensumi/core/pull/3251
- feat: optimize stream packet parse performance by @bytemain in https://github.com/opensumi/core/pull/3282
- feat: add sumi rpc by @bytemain in https://github.com/opensumi/core/pull/3284
- feat: support layout view size config by @Ricbet in https://github.com/opensumi/core/pull/3342
- feat: unified connection with different backend by @bytemain in https://github.com/opensumi/core/pull/3348
- feat: implement design module by @Ricbet in https://github.com/opensumi/core/pull/3350
- feat: remove implicit renderer runtime check by @bytemain in https://github.com/opensumi/core/pull/3360
- feat: product icon theme contributionPoint by @AhkunTa in https://github.com/opensumi/core/pull/3256
- feat: sumi rpc support read stream by @bytemain in https://github.com/opensumi/core/pull/3362
- feat: replace the extension script download source with Alipay CloudIDE Marketplace by @bk1012 in https://github.com/opensumi/core/pull/3380
- feat: support ai inline chat by @Ricbet in https://github.com/opensumi/core/pull/3378
- feat: replace marketplace to alipay cloudide marketplace by @bk1012 in https://github.com/opensumi/core/pull/3381
- feat: add log outputchannel api by @Aaaaash in https://github.com/opensumi/core/pull/3376
- feat: imporve tree property performance by @erha19 in https://github.com/opensumi/core/pull/3398
- feat: support ai native chat & chat agent by @Ricbet in https://github.com/opensumi/core/pull/3394
- feat: support ai inline completions by @bytemain in https://github.com/opensumi/core/pull/3400
- feat: support SourceControl.historyProvider by @pipiiiiii in https://github.com/opensumi/core/pull/3345
- feat: support configure collaboration server opts by @bytemain in https://github.com/opensumi/core/pull/3399
- feat: support ai 3 way merge by @Ricbet in https://github.com/opensumi/core/pull/3404
- feat: support SourceControlInputBox extension api by @pipiiiiii in https://github.com/opensumi/core/pull/3409
- feat: support collapse unchanged regions by @erha19 in https://github.com/opensumi/core/pull/3414
- feat: upgrade to monaco 0.47.0 by @bytemain in https://github.com/opensumi/core/pull/3418
- feat: support ai rename suggestions by @bytemain in https://github.com/opensumi/core/pull/3421
- feat: support ai native layout config by @Ricbet in https://github.com/opensumi/core/pull/3423
- feat: terminal ai feature by @life2015 in https://github.com/opensumi/core/pull/3422
- feat: terminal split screen operation supports single deletion by @wangxiaojuan in https://github.com/opensumi/core/pull/3043
- feat: optimize chat agent by @bk1012 in https://github.com/opensumi/core/pull/3458
- feat: when click file node, resize the bottom panel by @ckmilse in https://github.com/opensumi/core/pull/3389
- feat: upgrade monaco by @bytemain in https://github.com/opensumi/core/pull/3473
- feat: support ai layout renderer by @Ricbet in https://github.com/opensumi/core/pull/3490
- feat: implement Tab APIs by @MMhunter in https://github.com/opensumi/core/pull/3413
- feat: add inline chat event track by @Ricbet in https://github.com/opensumi/core/pull/3514
- feat: support custom chat render by @Ricbet in https://github.com/opensumi/core/pull/3499
- feat: show ai action on code action list by @bytemain in https://github.com/opensumi/core/pull/3476
- feat: support slash command provider render api by @Ricbet in https://github.com/opensumi/core/pull/3523
- feat: allow config ext process restart policy by @bytemain in https://github.com/opensumi/core/pull/3515
- feat: support ai merge conflict by @Ricbet in https://github.com/opensumi/core/pull/3531
- feat(ai): optimize code action by @bytemain in https://github.com/opensumi/core/pull/3541
- feat: support chat visible preference by @Ricbet in https://github.com/opensumi/core/pull/3554
- feat: support getHistoryMessages API by @Ricbet in https://github.com/opensumi/core/pull/3559
- feat(telemetry): add code actions and rename candidates event track by @bytemain in https://github.com/opensumi/core/pull/3560
- feat: support Dynamic DebugConfiguration Provider, add debug run toolbar by @life2015 in https://github.com/opensumi/core/pull/3557
- feat: support set language id for output channel by @bytemain in https://github.com/opensumi/core/pull/3582
- feat: chat input custom render by @wangxiaojuan in https://github.com/opensumi/core/pull/3568
- feat: render ext icon in menubar by @bytemain in https://github.com/opensumi/core/pull/3581
- feat(multiplexer): use slash to separate rpc id by @bytemain in https://github.com/opensumi/core/pull/3583
- feat: early preference support configure prefix by @bytemain in https://github.com/opensumi/core/pull/3584
- feat: adapt to the latest version of python extension by @hacke2 in https://github.com/opensumi/core/pull/3600
- feat: support codicon transform on popover markdown content by @erha19 in https://github.com/opensumi/core/pull/3598
- feat: optimize merge conflict by @bytemain in https://github.com/opensumi/core/pull/3585
- feat: use border-box as box-sizing by @bytemain in https://github.com/opensumi/core/pull/3608
- feat(rpc): add protocol for ext document service by @bytemain in https://github.com/opensumi/core/pull/3614
- feat: support stream on error event by @bytemain in https://github.com/opensumi/core/pull/3626
- feat: support interface quick navigation by @life2015 in https://github.com/opensumi/core/pull/3593
- feat: optimize tree node handling collapse/expand logic by @erha19 in https://github.com/opensumi/core/pull/3637
- feat: optimize typescript interface navigation by @life2015 in https://github.com/opensumi/core/pull/3638
- feat: optimize extension host restart logic by @bytemain in https://github.com/opensumi/core/pull/3635
- feat: optimize merge editor by @bytemain in https://github.com/opensumi/core/pull/3629

### Bug fixes

- fix: support DirectDebugAdapter debug type by @erha19 in https://github.com/opensumi/core/pull/3216
- fix: improve panel section description style by @erha19 in https://github.com/opensumi/core/pull/3166
- fix: layout view state logic and improve panel style by @erha19 in https://github.com/opensumi/core/pull/3344
- fix: design title actions style by @Ricbet in https://github.com/opensumi/core/pull/3412
- fix: file tree dialog style by @erha19 in https://github.com/opensumi/core/pull/3420
- fix: monaco hover widget styles by @Ricbet in https://github.com/opensumi/core/pull/3467
- fix: design module styles by @Ricbet in https://github.com/opensumi/core/pull/3569
- fix: clear tree node cache after the tree node is disposed by @xkaede in https://github.com/opensumi/core/pull/3109
- fix: omit display long title in markers by @chaoyue1217 in https://github.com/opensumi/core/pull/3167
- fix: scm module support chinese title #2977 by @zhuzeyu22 in https://github.com/opensumi/core/pull/3219
- fix: to #3224, Omit display description information by @yiliang114 in https://github.com/opensumi/core/pull/3225
- fix: restart extProcess on reconnect by @pipiiiiii in https://github.com/opensumi/core/pull/3245
- fix: stop event bubble when click comment by @erha19 in https://github.com/opensumi/core/pull/3295
- fix: improve split panel initialize by @erha19 in https://github.com/opensumi/core/pull/3338
- fix: monaco keybinding registry by @erha19 in https://github.com/opensumi/core/pull/3504
- fix: chat input auto focus by @Ricbet in https://github.com/opensumi/core/pull/3528
- fix: show comfirm button when dialog buttons is undefined by @erha19 in https://github.com/opensumi/core/pull/3512
- fix: diff editor missing dirty state indicator by @bytemain in https://github.com/opensumi/core/pull/3521
- fix: registerChatRender render error by @Ricbet in https://github.com/opensumi/core/pull/3533
- fix: more stable layout view restore process by @erha19 in https://github.com/opensumi/core/pull/3530
- fix: preferred formatter not work by @bytemain in https://github.com/opensumi/core/pull/3501
- fix: inline chat reporter by @Ricbet in https://github.com/opensumi/core/pull/3536
- fix: agent chat custom render by @Ricbet in https://github.com/opensumi/core/pull/3540
- fix: message open duration should be ms by @bytemain in https://github.com/opensumi/core/pull/3545
- fix: chat thinking render by @Ricbet in https://github.com/opensumi/core/pull/3544
- fix: multiplexer rpc id can have slash by @bytemain in https://github.com/opensumi/core/pull/3542
- fix: diagnostics api iterable fix by @life2015 in https://github.com/opensumi/core/pull/3566
- fix: optimize decoration clearing logic in tree service by @erha19 in https://github.com/opensumi/core/pull/3573
- fix: require interceptor handle react error by @bytemain in https://github.com/opensumi/core/pull/3570
- fix: rpc protocol devtools capturer by @bytemain in https://github.com/opensumi/core/pull/3558
- fix: fixes electron header rendering error in full screen mode by @MMhunter in https://github.com/opensumi/core/pull/3589
- fix: service registry cannot register transpiled class by @bytemain in https://github.com/opensumi/core/pull/3592
- fix: correct status bar item background color mapping by @erha19 in https://github.com/opensumi/core/pull/3594
- fix: design module register menubar by @bytemain in https://github.com/opensumi/core/pull/3597
- fix: reconnecting ws channel not work by @bytemain in https://github.com/opensumi/core/pull/3612
- fix: lock tree-sitter version by @bytemain in https://github.com/opensumi/core/pull/3617
- fix: inline diff editor format by @Ricbet in https://github.com/opensumi/core/pull/3618
- fix: fix design light theme button color by @zhanba in https://github.com/opensumi/core/pull/3603
- fix: delete request error log by @wangxiaojuan in https://github.com/opensumi/core/pull/3622
- fix: hightlight light theme by @Ricbet in https://github.com/opensumi/core/pull/3620
- fix: diff editor support revive by @Ricbet in https://github.com/opensumi/core/pull/3632
- fix: refresh not found provider by @Ricbet in https://github.com/opensumi/core/pull/3636
- fix: comment thread update by @erha19 in https://github.com/opensumi/core/pull/3369
- fix: electron cannot start by @bytemain in https://github.com/opensumi/core/pull/3346
- fix: output monaco instance will be init twice by @opensumi in https://github.com/opensumi/core/pull/3383
- fix: fix extension download error by @bk1012 in https://github.com/opensumi/core/pull/3384
- fix: uri should support serialize to json by @bytemain in https://github.com/opensumi/core/pull/3385
- fix: unexpected static resoure service import by @erha19 in https://github.com/opensumi/core/pull/3387
- fix: fix default layout state by @erha19 in https://github.com/opensumi/core/pull/3392
- fix: remove deprecated usage of less import statement by @opensumi in https://github.com/opensumi/core/pull/3397
- fix: 3way merge result model save error by @opensumi in https://github.com/opensumi/core/pull/3403
- fix: restore layout state on web lite by @erha19 in https://github.com/opensumi/core/pull/3406
- fix: ai reporter repeat by @Ricbet in https://github.com/opensumi/core/pull/3411
- fix: reveal extension tree node after tree handler exist by @erha19 in https://github.com/opensumi/core/pull/3415
- fix: tree do not need refresh when invisible by @bytemain in https://github.com/opensumi/core/pull/3401
- fix: default theme register icons contribution by @AhkunTa in https://github.com/opensumi/core/pull/3424
- fix: rename widget show keycode by @bytemain in https://github.com/opensumi/core/pull/3429
- fix: design module publish by @Ricbet in https://github.com/opensumi/core/pull/3431
- fix: chatService di by @Ricbet in https://github.com/opensumi/core/pull/3432
- fix: add mssing pkg by @bytemain in https://github.com/opensumi/core/pull/3433
- fix: collaborationOptions not pass by @bytemain in https://github.com/opensumi/core/pull/3437
- fix: remove all import from src by @bytemain in https://github.com/opensumi/core/pull/3449
- fix: improve diff editor first region position by @erha19 in https://github.com/opensumi/core/pull/3453
- fix: do toggle view error by @bytemain in https://github.com/opensumi/core/pull/3454
- fix: product icons contribution not initial by @AhkunTa in https://github.com/opensumi/core/pull/3469
- fix: missing zh-Hans translation by @bytemain in https://github.com/opensumi/core/pull/3464
- fix: hide editor readonly popup on output view by @crimx in https://github.com/opensumi/core/pull/3489
- fix: restore resource missing editor open types menu by @leavesster in https://github.com/opensumi/core/pull/3477
- fix: show all types debug session output by @erha19 in https://github.com/opensumi/core/pull/3491
- fix: language config maybe not match its location by @leavesster in https://github.com/opensumi/core/pull/3472
- fix(dep): semver need an old version lru-cache by @bytemain in https://github.com/opensumi/core/pull/3496
- fix(electron): keep defaultWebPreferences field by @leavesster in https://github.com/opensumi/core/pull/3498
- fix(diff-editor): add experimental sticky scroll option with defaults by @erha19 in https://github.com/opensumi/core/pull/3565
- fix(rpc): cancel cannot work by @bytemain in https://github.com/opensumi/core/pull/3382
- fix(diff-editor): optimize diff editor model caching and disposal handing by @erha19 in https://github.com/opensumi/core/pull/3572

### Refactor

- refactor: upgrade node-pty to 1.0.0 by @erha19 in https://github.com/opensumi/core/pull/3187
- refactor: update node ws channel code by @bytemain in https://github.com/opensumi/core/pull/3241
- refactor: upgrade mobx to v6 by @erha19 in https://github.com/opensumi/core/pull/3258
- refactor: remove mobx from preference panel by @bytemain in https://github.com/opensumi/core/pull/3366
- refactor: remove usage for editor api by @bytemain in https://github.com/opensumi/core/pull/3426
- refactor: chat service & support sendReplyMessage api by @Ricbet in https://github.com/opensumi/core/pull/3539
- refactor: use rc-tooltip to improve popover UX by @erha19 in https://github.com/opensumi/core/pull/3596
- refactor: update ext protocol registration by @bytemain in https://github.com/opensumi/core/pull/3616
- refactor: remove unused useDomSize prop from several components and update related logic by @erha19 in https://github.com/opensumi/core/pull/3627
- refactor: optimize SCM tree component initialization and remove warnings by @erha19 in https://github.com/opensumi/core/pull/3631
- refactor: chat invoke & chat api by @Ricbet in https://github.com/opensumi/core/pull/3630
- refactor: upgrade to react 18 by @erha19 in https://github.com/opensumi/core/pull/3171

### Style Changes

- style: panel use default zIndex by @erha19 in https://github.com/opensumi/core/pull/3170
- style: fix eslint by @bytemain in https://github.com/opensumi/core/pull/3240
- style: merge editor style fix by @AhkunTa in https://github.com/opensumi/core/pull/3233
- style: lint import statement by @bytemain in https://github.com/opensumi/core/pull/3308
- style: organize imports by @Ricbet in https://github.com/opensumi/core/pull/3357
- style: improve design styles by @Ricbet in https://github.com/opensumi/core/pull/3374
- style: improve design module style by @erha19 in https://github.com/opensumi/core/pull/3391
- style: improve input style on design mode by @erha19 in https://github.com/opensumi/core/pull/3416
- style(design): fix menu bar style by @bytemain in https://github.com/opensumi/core/pull/3456
- chore(deps): bump anser from 1.4.10 to 2.1.1 by @dependabot in https://github.com/opensumi/core/pull/3452
- style: improve debug frame style with design mode by @erha19 in https://github.com/opensumi/core/pull/3461
- style: use design mode specific layout by @erha19 in https://github.com/opensumi/core/pull/3462
- style: improve design tabbar style by @erha19 in https://github.com/opensumi/core/pull/3470
- style: improve design style by @Ricbet in https://github.com/opensumi/core/pull/3466
- style: improve ai native layout by @Ricbet in https://github.com/opensumi/core/pull/3495
- style: improve tabbar icon style by @erha19 in https://github.com/opensumi/core/pull/3503
- style: improve monaco hover widget style by @erha19 in https://github.com/opensumi/core/pull/3511
- style: fix merge toolbar z-index by @bytemain in https://github.com/opensumi/core/pull/3524
- style: improve tabbar margin style by @erha19 in https://github.com/opensumi/core/pull/3552
- fix(styles): fix design module style issues by @bytemain in https://github.com/opensumi/core/pull/3586
- style: improve design style by @Ricbet in https://github.com/opensumi/core/pull/3606
- style: adjust markdown styles for better readability by @erha19 in https://github.com/opensumi/core/pull/3607
- style: adjust overlay close button margin and handle disposed diff editor model by @erha19 in https://github.com/opensumi/core/pull/3623
- fix(style): update menubar right style by @bytemain in https://github.com/opensumi/core/pull/3628
- style: update Popover component usage by @erha19 in https://github.com/opensumi/core/pull/3634
- style: improve actionbar selection background color by @Ricbet in https://github.com/opensumi/core/pull/3640

### Other Changes

- chore: improve treenode unit test by @erha19 in https://github.com/opensumi/core/pull/3123
- chore(deps): bump @babel/traverse from 7.20.13 to 7.23.2 by @dependabot in https://github.com/opensumi/core/pull/3129
- chore(deps): bump browserify-sign from 4.2.1 to 4.2.2 in /tools/electron by @dependabot in https://github.com/opensumi/core/pull/3144
- chore(deps): bump browserify-sign from 4.2.1 to 4.2.2 by @dependabot in https://github.com/opensumi/core/pull/3143
- chore: optimized test description by @wjywy in https://github.com/opensumi/core/pull/3147
- build: exit build if tsc error by @bytemain in https://github.com/opensumi/core/pull/3239
- chore(deps): bump follow-redirects from 1.15.2 to 1.15.4 by @dependabot in https://github.com/opensumi/core/pull/3268
- ci: upgrade playwright version by @bytemain in https://github.com/opensumi/core/pull/3270
- chore(release): v2.27.2 by @erha19 in https://github.com/opensumi/core/pull/3285
- chore(deps): update deps and types by @bytemain in https://github.com/opensumi/core/pull/3287
- build: upgrade to webpack5 by @bytemain in https://github.com/opensumi/core/pull/3303
- chore: remove github copilot for prs supported by @erha19 in https://github.com/opensumi/core/pull/3306
- build: add railway build config by @bytemain in https://github.com/opensumi/core/pull/3311
- chore: update railway config by @bytemain in https://github.com/opensumi/core/pull/3313
- chore: update vscode-codicons version by @Aaaaash in https://github.com/opensumi/core/pull/3300
- docs: add codeblitz to getting started by @hacke2 in https://github.com/opensumi/core/pull/3231
- chore(deps): bump ip from 2.0.0 to 2.0.1 in /tools/electron by @dependabot in https://github.com/opensumi/core/pull/3352
- chore: deprecated slot background color by @Ricbet in https://github.com/opensumi/core/pull/3359
- chore: initialization ai native module by @Ricbet in https://github.com/opensumi/core/pull/3368
- chore: upgrade monaco version 0.45.0 by @Ricbet in https://github.com/opensumi/core/pull/3257
- chore(deps): bump follow-redirects from 1.15.5 to 1.15.6 by @dependabot in https://github.com/opensumi/core/pull/3407
- chore: remove duplicate code by @l1shen in https://github.com/opensumi/core/pull/3419
- chore(deps): bump webpack-dev-middleware from 5.3.3 to 5.3.4 by @dependabot in https://github.com/opensumi/core/pull/3434
- chore: update deps by @bytemain in https://github.com/opensumi/core/pull/3436
- chore(deps): bump actions/checkout from 2 to 4 by @dependabot in https://github.com/opensumi/core/pull/3438
- chore(deps-dev): bump @types/node from 18.19.24 to 20.11.30 by @dependabot in https://github.com/opensumi/core/pull/3444
- chore(deps): bump lannonbr/repo-permission-check-action from 2.0.0 to 2.0.2 by @dependabot in https://github.com/opensumi/core/pull/3442
- ci: fix release ci by @bytemain in https://github.com/opensumi/core/pull/3448
- chore(deps): bump fs-extra and @types/fs-extra by @dependabot in https://github.com/opensumi/core/pull/3447
- refactor: use better design token name by @erha19 in https://github.com/opensumi/core/pull/3463
- chore(deps): bump lint-staged from 12.5.0 to 15.2.2 by @dependabot in https://github.com/opensumi/core/pull/3446
- chore(deps): bump mobx-react-lite from 4.0.6 to 4.0.7 by @dependabot in https://github.com/opensumi/core/pull/3480
- chore(deps): bump write-file-atomic from 4.0.2 to 5.0.1 by @dependabot in https://github.com/opensumi/core/pull/3479
- ci: use node 18.x by @bytemain in https://github.com/opensumi/core/pull/3517
- chore(deps): bump peaceiris/actions-gh-pages from 3 to 4 by @dependabot in https://github.com/opensumi/core/pull/3505
- chore: improve chatthinking component by @Ricbet in https://github.com/opensumi/core/pull/3529
- chore: upgrade to yarn 4.1.1 by @bytemain in https://github.com/opensumi/core/pull/3526
- chore(deps): bump webpack from 5.90.3 to 5.91.0 by @dependabot in https://github.com/opensumi/core/pull/3550
- ci: use jest circus runner by @bytemain in https://github.com/opensumi/core/pull/3527
- chore(deps-dev): bump @commitlint/cli from 19.2.1 to 19.2.2 by @dependabot in https://github.com/opensumi/core/pull/3547
- ci: yarn cache might be timeout sometimes by @bytemain in https://github.com/opensumi/core/pull/3571
- chore: update rpc benchmark by @bytemain in https://github.com/opensumi/core/pull/3625
- chore(deps): bump ejs from 3.1.9 to 3.1.10 by @dependabot in https://github.com/opensumi/core/pull/3610
- chore: remove unused StartupModule from web app entry by @erha19 in https://github.com/opensumi/core/pull/3639
- chore(release): release v3.0.0-alpha.0 by @bytemain in https://github.com/opensumi/core/pull/3641
- docs: update readme for the 3.0 version by @erha19 in https://github.com/opensumi/core/pull/3642
- chore(deps): bump xterm from 5.2.0 to 5.3.0 by @dependabot in https://github.com/opensumi/core/pull/3506
- chore(deps-dev): bump @typescript-eslint/eslint-plugin from 5.62.0 to 7.6.0 by @dependabot in https://github.com/opensumi/core/pull/3508
- chore(deps): bump @playwright/test from 1.40.1 to 1.43.0 by @dependabot in https://github.com/opensumi/core/pull/3507
- chore(deps): bump commitlint from 15.0.0 to 19.2.1 by @dependabot in https://github.com/opensumi/core/pull/3445
- chore(deps): bump pkgdeps/git-tag-action from 2 to 3 by @dependabot in https://github.com/opensumi/core/pull/3440
- chore(deps): bump mukunku/tag-exists-action from 1.0.0 to 1.6.0 by @dependabot in https://github.com/opensumi/core/pull/3441
- chore: remove gpt review action by @erha19 in https://github.com/opensumi/core/pull/3226
- chore(deps): bump @koa/cors from 3.4.3 to 5.0.0 by @dependabot in https://github.com/opensumi/core/pull/3234
- chore(deps): bump postcss from 8.4.21 to 8.4.35 by @dependabot in https://github.com/opensumi/core/pull/3343
- chore(deps): bump tar from 6.1.12 to 6.2.1 in /tools/electron by @dependabot in https://github.com/opensumi/core/pull/3519

## New Contributors

- @wjywy made their first contribution in https://github.com/opensumi/core/pull/3095
- @chaoyue1217 made their first contribution in https://github.com/opensumi/core/pull/3167
- @yiliang114 made their first contribution in https://github.com/opensumi/core/pull/3225
- @ckmilse made their first contribution in https://github.com/opensumi/core/pull/3389
- @crimx made their first contribution in https://github.com/opensumi/core/pull/3489
- @leavesster made their first contribution in https://github.com/opensumi/core/pull/3477

<a name="breaking_changes_3.0.0">[Breaking Changes:](#breaking_changes_3.0.0)</a>

#### 1. use `positionToRange` instead of `toRange`

```diff
- import { toRange } from '@opensumi/ide-comments';
+ import { positionToRange } from '@opensumi/ide-monaco';
```

#### 2. we remove `vscode-jsonrpc` dependency

If you facing the error like:

```log
Uncaught (in promise) Error: No runtime abstraction layer installed
  at RAL (xxx.js:xx:x)
```

please add `import '@opensumi/vscode-jsonrpc/lib/node/main';` on the top of your main file.

#### 3. new Popover component

Some component props changed.

- insertClass -> overlayClassName
- display -> visible
- onDisplayChange -> onVisibleChange

#### 4. uprage react version to 18

Please upgrade your react version to 18.

#### 5. upgrade mobx version to 6

Please upgrade your mobx version to 6.

## v2.27.0

### What's New Features

- feat: add activate keybinding for explorer and search view by @erha19 in https://github.com/opensumi/core/pull/2930
- feat: support vscode.l10n api by @erha19 in https://github.com/opensumi/core/pull/3002
- feat: ws reconnect report connection info by @pipiiiiii in https://github.com/opensumi/core/pull/3030
- feat: add editor top side bar support by @MilkWangStudio in https://github.com/opensumi/core/pull/3026
- feat: change createRef to useRef by @winjo in https://github.com/opensumi/core/pull/2932
- feat: drop electron 13 support by @bytemain in https://github.com/opensumi/core/pull/3050
- feat: notification support button by @pipiiiiii in https://github.com/opensumi/core/pull/3073
- style: open editor displays the delete button in its selected state by @wangxiaojuan in https://github.com/opensumi/core/pull/3103

### Refactor

- refactor(ext): improve code and log message by @bytemain in https://github.com/opensumi/core/pull/2948

### Patch Changes

- chore(deps-dev): bump electron from 22.3.23 to 22.3.24 by @dependabot in https://github.com/opensumi/core/pull/3069
- chore(deps-dev): bump electron from 18.3.15 to 22.3.25 in /tools/electron by @dependabot in https://github.com/opensumi/core/pull/3098

### Other Changes

- fix: invalid breakpoints line number error by @erha19 in https://github.com/opensumi/core/pull/3037
- fix: filetree rename file correctly by @erha19 in https://github.com/opensumi/core/pull/3108
- doc: add codeblitz badge by @hacke2 in https://github.com/opensumi/core/pull/3088
- chore(deps): bump word-wrap from 1.2.3 to 1.2.4 by @dependabot in https://github.com/opensumi/core/pull/2911
- fix: scm support double click to openfile by @pipiiiiii in https://github.com/opensumi/core/pull/2937
- fix: terminal search box supports toggle switching by @wangxiaojuan in https://github.com/opensumi/core/pull/3041
- fix: custom components are not destroyed after being closed by @xkaede in https://github.com/opensumi/core/pull/3036
- ci: use nodejs 16.x by @bytemain in https://github.com/opensumi/core/pull/3063
- fix: toolbar width should change when props change by @bytemain in https://github.com/opensumi/core/pull/3065
- fix: search box placeholder color by @wangxiaojuan in https://github.com/opensumi/core/pull/3039
- chore(deps-dev): bump electron from 22.3.24 to 22.3.25 by @dependabot in https://github.com/opensumi/core/pull/3099
- fix: terminal shortcut kill process in windows by @shilin8805 in https://github.com/opensumi/core/pull/3100
- fix: register sumi api in worker by @AhkunTa in https://github.com/opensumi/core/pull/3072
- chore(deps): bump ejs from 2.7.4 to 3.1.7 by @dependabot in https://github.com/opensumi/core/pull/3107
- fix: show first level child when folder tree node is filtered by @erha19 in https://github.com/opensumi/core/pull/3086
- fix: fix electron ide build error by @shilin8805 in https://github.com/opensumi/core/pull/3113
- chore: add retry for extension download by @hacke2 in https://github.com/opensumi/core/pull/3117
- fix: error color by @nonzzz in https://github.com/opensumi/core/pull/3118

## New Contributors

- @MilkWangStudio made their first contribution in https://github.com/opensumi/core/pull/3026
- @xkaede made their first contribution in https://github.com/opensumi/core/pull/3036
- @nonzzz made their first contribution in https://github.com/opensumi/core/pull/3118

**Full Changelog**: https://github.com/opensumi/core/compare/v2.26.8...v2.27.0

## v2.26.0

### What's New Features

- feat: bottom panel support accordion by @Aaaaash in https://github.com/opensumi/core/pull/2798
- feat: support InlineCompletionItemProvider.handleDidShowCompletionItem API by @erha19 in https://github.com/opensumi/core/pull/2799
- feat: support search preference by @ext expression by @erha19 in https://github.com/opensumi/core/pull/2813
- feat: support overwrite when editor save by @winjo in https://github.com/opensumi/core/pull/2846
- feat: support use npmmirror cdn url by @bytemain in https://github.com/opensumi/core/pull/2830
- feat: editor tab support revealInExplorer by @pipiiiiii in https://github.com/opensumi/core/pull/2848
- feat: support merge editor accept left or right by @Ricbet in https://github.com/opensumi/core/pull/2839
- feat: improve render blank lines breakpoints by @Ricbet in https://github.com/opensumi/core/pull/2832
- fix: merge editor not support wordwrap by @Ricbet in https://github.com/opensumi/core/pull/2836
- feat: support resolve in merge editor by @Ricbet in https://github.com/opensumi/core/pull/2819
- feat: improve merge editor result title by @Ricbet in https://github.com/opensumi/core/pull/2835
- feat: support register view container in bottom panel by @Aaaaash in https://github.com/opensumi/core/pull/2847
- feat: support merge editor reset by @Ricbet in https://github.com/opensumi/core/pull/2841
- feat: support scm setInputBoxEnablement API & getSourceControl API by @Ricbet in https://github.com/opensumi/core/pull/2863
- feat: support merge editor minimap by @Ricbet in https://github.com/opensumi/core/pull/2859
- feat: implement scm contributes by @Ricbet in https://github.com/opensumi/core/pull/2867
- feat: infer second terminal cwd from the first one by @bytemain in https://github.com/opensumi/core/pull/2852
- feat: support showBreakpointsInOverviewRuler by @Ricbet in https://github.com/opensumi/core/pull/2902

### Style Changes

- fix: left panel style lower right menu style by @wangxiaojuan in https://github.com/opensumi/core/pull/2818
- fix: update the style of the currently selected file menu by @wangxiaojuan in https://github.com/opensumi/core/pull/2810
- fix: navigation menu style rendering problem by @wangxiaojuan in https://github.com/opensumi/core/pull/2807
- fix: button white-space style by @Aaaaash in https://github.com/opensumi/core/pull/2817
- style: merge editor left view padding by @Ricbet in https://github.com/opensumi/core/pull/2837
- style: input disabled style by @Ricbet in https://github.com/opensumi/core/pull/2861
- style: change resize handler z-index by @erha19 in https://github.com/opensumi/core/pull/2868
- fix: left panel style lower right menu style by @wangxiaojuan in https://github.com/opensumi/core/pull/2888
- style: improve secondary button hover style by @erha19 in https://github.com/opensumi/core/pull/2890
- chore: remove deprecated usage of less expression by @erha19 in https://github.com/opensumi/core/pull/2906

### Other Changes

- chore: add lint rules for ignore warning by @pipiiiiii in https://github.com/opensumi/core/pull/2855
- chore: remove unused import vars by @pipiiiiii in https://github.com/opensumi/core/pull/2856
- chore: fix warnings and remove some useless code by @erha19 in https://github.com/opensumi/core/pull/2795
- fix: add key for MenuActionList by @winjo in https://github.com/opensumi/core/pull/2809
- fix: worker api not execute by @AhkunTa in https://github.com/opensumi/core/pull/2879
- fix: add keys for fragment by @Aaaaash in https://github.com/opensumi/core/pull/2812
- fix: plugin panel height adjustment by @wangxiaojuan in https://github.com/opensumi/core/pull/2823
- fix: terminal adds top whitespace by @wangxiaojuan in https://github.com/opensumi/core/pull/2821
- fix: check undefined of preference item default value by @winjo in https://github.com/opensumi/core/pull/2834
- fix: add key for preference item description list by @winjo in https://github.com/opensumi/core/pull/2840
- chore: update xterm.js by @Aaaaash in https://github.com/opensumi/core/pull/2825
- chore: optimize split panel re-render by @Aaaaash in https://github.com/opensumi/core/pull/2851
- chore(deps): bump semver from 6.3.0 to 7.5.2 by @dependabot in https://github.com/opensumi/core/pull/2826
- chore: remove sanitize in marked options by @bytemain in https://github.com/opensumi/core/pull/2850
- fix: unwatchFileChanges api do not work on file service by @miserylee in https://github.com/opensumi/core/pull/2824
- chore(deps): bump semver from 5.7.1 to 5.7.2 in /tools/electron by @dependabot in https://github.com/opensumi/core/pull/2882
- fix: add version to download-extension targetDirName by @pipiiiiii in https://github.com/opensumi/core/pull/2877
- fix: except breakpoint blank description by @Ricbet in https://github.com/opensumi/core/pull/2878
- fix(ext): extension cannot reset validateMessage to undefined by @bytemain in https://github.com/opensumi/core/pull/2889
- fix: debug console repl not show by @Ricbet in https://github.com/opensumi/core/pull/2898
- fix: title-bar add i18n tips (#2903) by @zhuzeyu22 in https://github.com/opensumi/core/pull/2905
- fix(preference): rerender Select component if localized string changed by @bytemain in https://github.com/opensumi/core/pull/2892
- chore: optimize treeview re-render by @Aaaaash in https://github.com/opensumi/core/pull/2833

## New Contributors

- @zhuzeyu22 made their first contribution in https://github.com/opensumi/core/pull/2905

**Full Changelog**: https://github.com/opensumi/core/compare/v2.25.4...v2.26.0

<a name="breaking_changes_2.26.0">[Breaking Changes:](#breaking_changes_2.26.0)</a>

#### 1. Remove `~` prefix in the less file [#2906](https://github.com/opensumi/core/pull/2906)

The `~` expression is deprecated on the latest less-loader, see [less-loader/#webpack-resolver](https://webpack.js.org/loaders/less-loader/#webpack-resolver).

If you have the `Module not found` error, you can update your webpack config like this:

```ts
module.exports = {
  module: {
    rules: [
      {
        test: /\.less$/i,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
          },
          {
            loader: 'less-loader',
            options: {
              lessOptions: {
                paths: [path.resolve(__dirname, 'node_modules')],
              },
            },
          },
        ],
      },
    ],
  },
};
```

## v2.25.0

### What's New Features

- feat: quickInput support hideOnDidAccept by @pipiiiiii in https://github.com/opensumi/core/pull/2631
- feat: improve the interaction for enabling/disabling breakpoints by @Ricbet in https://github.com/opensumi/core/pull/2615
- feat: debug breakpoint file items supports enable/disable switch by @Ricbet in https://github.com/opensumi/core/pull/2611
- feat: update command open terminal setting by @AhkunTa in https://github.com/opensumi/core/pull/2660
- feat: support flashing prompt for focus breakpoints in the editor by @Ricbet in https://github.com/opensumi/core/pull/2652
- feat: support delete or edit breakpoints when hovering on the it by @Ricbet in https://github.com/opensumi/core/pull/2655
- feat: menuActionList component support style css properties by @Ricbet in https://github.com/opensumi/core/pull/2711
- feat: support icon menubar by @Ricbet in https://github.com/opensumi/core/pull/2728
- fix: use currentOrPreviousFocusedEditor on search by @pipiiiiii in https://github.com/opensumi/core/pull/2761
- feat: optimize file tree node decoration, support codicon by @Aaaaash in https://github.com/opensumi/core/pull/2768
- feat: open resource when click comment item by @Aaaaash in https://github.com/opensumi/core/pull/2769
- feat: add arrow for zonewidget by @Aaaaash in https://github.com/opensumi/core/pull/2763
- feat: support xterm render type select by @life2015 in https://github.com/opensumi/core/pull/2754
- feat: add registered scheme by @Aaaaash in https://github.com/opensumi/core/pull/2774
- feat: support input number component by @Ricbet in https://github.com/opensumi/core/pull/2630
- feat: support launch editor UI by @Ricbet in https://github.com/opensumi/core/pull/2574
- feat: throw error if get file stat error by @bytemain in https://github.com/opensumi/core/pull/2773
- feat: improve breakpoint style by @bytemain in https://github.com/opensumi/core/pull/2779
- feat: menu action support codicon by @Aaaaash in https://github.com/opensumi/core/pull/2778
- feat: auto expand the comment widget when click comment tree item by @Aaaaash in https://github.com/opensumi/core/pull/2777

### Refactor

- refactor: use sumiContributes and compatible with kaitianContributes by @erha19 in https://github.com/opensumi/core/pull/2664
- refactor: auto update decoration targets by @erha19 in https://github.com/opensumi/core/pull/2690
- refactor: consolidated clientId retrieval code by @bytemain in https://github.com/opensumi/core/pull/2703
- style: improve section label and badge style by @erha19 in https://github.com/opensumi/core/pull/2758
- refactor: extract electron essentials by @bytemain in https://github.com/opensumi/core/pull/2742
- refactor: migration static-resource to core-browser by @Aaaaash in https://github.com/opensumi/core/pull/2776
- refactor: extract platform specific code by @bytemain in https://github.com/opensumi/core/pull/2780

### Style Changes

- fix: reference pannel style error by @wangxiaojuan in https://github.com/opensumi/core/pull/2606
- style: optimize sidebar icon size by @bk1012 in https://github.com/opensumi/core/pull/2672
- fix: monaco Action Bar style by @wangxiaojuan in https://github.com/opensumi/core/pull/2720
- fix: treenode styles by @Aaaaash in https://github.com/opensumi/core/pull/2770
- style: stop flexbox removing trailing whitespace on menu action by @erha19 in https://github.com/opensumi/core/pull/2784
- style: improve terminal split view border style by @erha19 in https://github.com/opensumi/core/pull/2783

### Other Changes

- chore: ignore scripts of building cli engine by @erha19 in https://github.com/opensumi/core/pull/2608
- chore: remove gitpod by @opensumi in https://github.com/opensumi/core/pull/2634
- test: add extension E2E test case by @pipiiiiii in https://github.com/opensumi/core/pull/2638
- chore: remove useless workflow and issue template by @erha19 in https://github.com/opensumi/core/pull/2678
- Revert "fix: remove the marked.js warning about sanitize and add sanitizer" by @bytemain in https://github.com/opensumi/core/pull/2731
- chore: update git extension to v1.68.1 by @erha19 in https://github.com/opensumi/core/pull/2760
- fix: add default input value for TerminalSearchService by @winjo in https://github.com/opensumi/core/pull/2762
- fix: check if element of popover exists when delayed hidden by @winjo in https://github.com/opensumi/core/pull/2764
- fix: check if currentGroup is empty when split terminal by @winjo in https://github.com/opensumi/core/pull/2766
- fix: input component defaultValue failed by @Ricbet in https://github.com/opensumi/core/pull/2751
- fix: only add default color once by @pipiiiiii in https://github.com/opensumi/core/pull/2753
- chore: optimize menuaction list renderer by @Aaaaash in https://github.com/opensumi/core/pull/2775
- fix: conditional breakpoint centering by @Ricbet in https://github.com/opensumi/core/pull/2666
- fix: set default language by @limerickgds in https://github.com/opensumi/core/pull/2722
- fix: on disposeResource delete resourceDecoration by @l1shen in https://github.com/opensumi/core/pull/2785

## New Contributors

- @limerickgds made their first contribution in https://github.com/opensumi/core/pull/2722

<a name="breaking_changes_2.25.0">[Breaking Changes:](#breaking_changes_2.25.0)</a>

#### 1. The package`@opensumi/ide-static-resource` will be removed soon [#2776](https://github.com/opensumi/core/pull/2776)

In this version, you no longer need to introduce the redundant package `@opensumi/ide-static-resource` in your project.

At the same time, this package will be removed after version 2.27.0, please pay attention.

## v2.24.0

### What's New Features

- feat: support skipFiles on debug call stack frames view by @erha19 in https://github.com/opensumi/core/pull/2468
- feat: support setting: editor.unicodeHighlight.ambiguousCharacters by @winjo in https://github.com/opensumi/core/pull/2527
- feat: add language data into work host env by @winjo in https://github.com/opensumi/core/pull/2532
- feat: support displaying debug breakpoints in a tree view by @Ricbet in https://github.com/opensumi/core/pull/2512
- fix: github light hight theme button color wrong by @wangxiaojuan in https://github.com/opensumi/core/pull/2499
- feat: support show unsaved files in opened editor view by @AhkunTa in https://github.com/opensumi/core/pull/2491
- feat: support maxResize props on the panel by @erha19 in https://github.com/opensumi/core/pull/2569
- feat(editor): editor save code action notify configuration by @shilin8805 in https://github.com/opensumi/core/pull/2580
- fix: change prefix when open view by @winjo in https://github.com/opensumi/core/pull/2586
- feat: quick-open support busy option by @pipiiiiii in https://github.com/opensumi/core/pull/2579
- feat: menubar supports compact mode by @Ricbet in https://github.com/opensumi/core/pull/2556
- fix(theme): foucs first entry theme when then input is not empty by @winjo in https://github.com/opensumi/core/pull/2589
- feat: support debug configuration and toolbar view component by @Ricbet in https://github.com/opensumi/core/pull/2563
- feat(editor): editor save code action notify configuration by @shilin8805 in https://github.com/opensumi/core/pull/2599
- feat: rpcProtocol add timeout control by @pipiiiiii in https://github.com/opensumi/core/pull/2587

### Refactor

- refactor: refactor file-watcher test case by @pipiiiiii in https://github.com/opensumi/core/pull/2463
- refactor: replace quickopen label render function from parseLabel to transformLabelWithCodicon by @pipiiiiii in https://github.com/opensumi/core/pull/2498

### Style Changes

- style: add hover color token to editor tabs by @erha19 in https://github.com/opensumi/core/pull/2577
- fix: improve style and fix breakpoints view init by @erha19 in https://github.com/opensumi/core/pull/2583
- style: improve button disable style by @Ricbet in https://github.com/opensumi/core/pull/2594

### Other Changes

- chore: export localizationRegistryMap by @miserylee in https://github.com/opensumi/core/pull/2482
- fix: quickopen panel display correct localize by @pipiiiiii in https://github.com/opensumi/core/pull/2494
- fix: should set renderMarginRevertIcon=false when diffEditor is readOnly by @miserylee in https://github.com/opensumi/core/pull/2492
- fix: call stack stop at incorrect line because call frame with sameid by @geekeren in https://github.com/opensumi/core/pull/2487
- docs: update CHANGELOG.md by @bytemain in https://github.com/opensumi/core/pull/2501
- fix: improve exclude function on search view by @winjo in https://github.com/opensumi/core/pull/2536
- fix: return statement will break for..of loop by @miserylee in https://github.com/opensumi/core/pull/2544
- chore: update bug-report issue template by @erha19 in https://github.com/opensumi/core/pull/2539
- chore: rewrite some logs message and add not-chinese-message commit rule by @erha19 in https://github.com/opensumi/core/pull/2542
- fix: copy diff uri path at editor tab by @ensorrow in https://github.com/opensumi/core/pull/2513
- chore: update PRs template to support Copilot for PRs by @erha19 in https://github.com/opensumi/core/pull/2551
- fix: change the way to capture IPC messages so listeners passed to ipcRenderer.on are now disposable by @tyn1998 in https://github.com/opensumi/core/pull/2555
- fix: update the active editor when the editor cursor changes by @Aaaaash in https://github.com/opensumi/core/pull/2488
- chore: add key for HighlightLabel by @winjo in https://github.com/opensumi/core/pull/2588
- fix: remove the marked.js warning about sanitize and add sanitizer by @PerfectPan in https://github.com/opensumi/core/pull/2591
- fix: foreground color of the match highlights on actively focused items by @wangxiaojuan in https://github.com/opensumi/core/pull/2564
- fix: open file by vscode.open command by @erha19 in https://github.com/opensumi/core/pull/2593
- fix: webview csp source by @life2015 in https://github.com/opensumi/core/pull/2597
- fix(core-browser): move react to peerDependencies by @gemwuu in https://github.com/opensumi/core/pull/2562
- fix: transformLabelWithCodicon white space by @Ricbet in https://github.com/opensumi/core/pull/2600

## New Contributors

- @geekeren made their first contribution in https://github.com/opensumi/core/pull/2487
- @gemwuu made their first contribution in https://github.com/opensumi/core/pull/2562

## v2.23.0

### What's New Features

- feat: support electron titlebar string template by @yantze in https://github.com/opensumi/core/pull/2194
- feat: add empty implementation for `Terminal Location` API by @bytemain in https://github.com/opensumi/core/pull/2202
- feat: add cli engine by @bk1012 in https://github.com/opensumi/core/pull/2210
- chore: show extension download error by @bk1012 in https://github.com/opensumi/core/pull/2266
- feat: menubar component will reset focus after click by @pipiiiiii in https://github.com/opensumi/core/pull/2284
- feat: read-only resource render lock icon by @Ricbet in https://github.com/opensumi/core/pull/2309
- feat: support inspectExtensionHost config by @Ricbet in https://github.com/opensumi/core/pull/2310
- feat: breadcrumbs support menus by @wangxiaojuan in https://github.com/opensumi/core/pull/2258
- feat: editor tab title display file path by @hacke2 in https://github.com/opensumi/core/pull/2343
- feat: statusbar pophover support icon by @hacke2 in https://github.com/opensumi/core/pull/2340
- feat: compatibility with the experimental API registerTimelineProvider by @PerfectPan in https://github.com/opensumi/core/pull/2438
- feat: toolbar dropdown-button contribute by @hacke2 in https://github.com/opensumi/core/pull/2312

### Refactor

- refactor: remove some useless icons by @erha19 in https://github.com/opensumi/core/pull/2204
- refactor: remove unused application error definition by @erha19 in https://github.com/opensumi/core/pull/2403
- fix: ensure outline is displayed properly by @bytemain in https://github.com/opensumi/core/pull/2440

### Style Changes

- style: improve outline treenode style by @erha19 in https://github.com/opensumi/core/pull/2329

### Other Changes

- fix: collaboration initialize by @Ricbet in https://github.com/opensumi/core/pull/2207
- build(deps): bump cookiejar from 2.1.3 to 2.1.4 by @dependabot in https://github.com/opensumi/core/pull/2216
- fix: remove collaboration preference code by @Ricbet in https://github.com/opensumi/core/pull/2221
- build(deps): bump http-cache-semantics from 4.1.0 to 4.1.1 in /tools/electron by @dependabot in https://github.com/opensumi/core/pull/2236
- chore: add E2E test badge by @erha19 in https://github.com/opensumi/core/pull/2237
- fix: quick open hightlight label whitespace by @Ricbet in https://github.com/opensumi/core/pull/2265
- fix: support Trim Final NewLines configuration by @pipiiiiii in https://github.com/opensumi/core/pull/2277
- chore: remove engines required on package.json by @erha19 in https://github.com/opensumi/core/pull/2267
- fix: scm badge is too large to display the problem by @wangxiaojuan in https://github.com/opensumi/core/pull/2274
- chore: update license notice by @erha19 in https://github.com/opensumi/core/pull/2300
- fix: add margins to the QuickOpen input by @wangxiaojuan in https://github.com/opensumi/core/pull/2299
- fix: modified readonly logic of diff editor by @Ricbet in https://github.com/opensumi/core/pull/2295
- chore: update extension engine version to 1.68.0 by @erha19 in https://github.com/opensumi/core/pull/2302
- chore: improve terminal debug test by @erha19 in https://github.com/opensumi/core/pull/2304
- tests: add collaboration module test case by @pipiiiiii in https://github.com/opensumi/core/pull/2306
- fix: support normal prelunchTask on debug by @erha19 in https://github.com/opensumi/core/pull/2330
- fix: sync file dirty status after spliting files by @erha19 in https://github.com/opensumi/core/pull/2323
- chore: remove drivelist by @AhkunTa in https://github.com/opensumi/core/pull/2281
- fix(collaboration): change default color by @winjo in https://github.com/opensumi/core/pull/2348
- chore: remove useless application interface by @erha19 in https://github.com/opensumi/core/pull/2344
- fix: improve context menu content fontsize by @wangxiaojuan in https://github.com/opensumi/core/pull/2351
- chore: update render mode comment by @erha19 in https://github.com/opensumi/core/pull/2353
- Revert "fix: use bash resolve shellpath" by @yantze in https://github.com/opensumi/core/pull/2347
- chore: remove unused value in extension.service.ts by @bk1012 in https://github.com/opensumi/core/pull/2375
- ci: add workflow for code review by @bytemain in https://github.com/opensumi/core/pull/2395
- test: scm list view mode e2e by @Ricbet in https://github.com/opensumi/core/pull/2387
- fix: show theme quick picker after theme extension installed by @PerfectPan in https://github.com/opensumi/core/pull/2398
- chore: remove node-notifier from cli-engine by @erha19 in https://github.com/opensumi/core/pull/2400
- fix: remove status bar warnings by @erha19 in https://github.com/opensumi/core/pull/2407
- chore: update community information by @erha19 in https://github.com/opensumi/core/pull/2413
- chore: build cli-engine before publish by @erha19 in https://github.com/opensumi/core/pull/2430
- chore: download extension on Windows by @fankangsong in https://github.com/opensumi/core/pull/2436
- chore: update cli-engine versison by @erha19 in https://github.com/opensumi/core/pull/2422
- ci: add secrets check by @erha19 in https://github.com/opensumi/core/pull/2439
- chore: support build cli-engine before release by @erha19 in https://github.com/opensumi/core/pull/2441
- fix: namespace conflicts between extHost and extBrowser by @yantze in https://github.com/opensumi/core/pull/2415
- fix: support haxe hashlink debug by @erha19 in https://github.com/opensumi/core/pull/2393
- fix: logger should have default value to avoid error to be overridden by @miserylee in https://github.com/opensumi/core/pull/2433
- fix: output clear icon lag renderer by @Ricbet in https://github.com/opensumi/core/pull/2447
- fix: file watcher path error on Windows by @erha19 in https://github.com/opensumi/core/pull/2455
- fix: electron menus will be called more than once by @erha19 in https://github.com/opensumi/core/pull/2453
- fix: ensure preference ready before render editor by @bytemain in https://github.com/opensumi/core/pull/2451
- fix: delegate closeUnmodifiedEditors command by @bytemain in https://github.com/opensumi/core/pull/2619

<a name="breaking_changes_2.23.0">[Breaking Changes:](#breaking_changes_2.23.0)</a>

#### 1. Remove some useless built-in icons [#2204](https://github.com/opensumi/core/pull/2204)

This version we remove some useless filled icons on the framework and use outlined icons on the Tree Component.

- `warning-circle-fill`
- `ubuntu`
- `time-circle-fill`
- `minus-circle-fill`
- `kaitian`
- `huoban-blue`
- `huoban`
- `folder-open-fill`
- `folder-open`
- `folder-fill`
- `execute`
- `control-fill`
- `dashboard-fill`
- `compass-fill`
- `codelibrary-fill`
- `check-square-fill`
- `bulb-fill`
- `basement-fileicon`
- `basement`
- `anymock`
- `LinkE`

#### 2. Task label format changed

In order to be compatible with the use of Task commands by some extensions.

The task label format change from `{0} : {1}` to `{0}: {1}`, like `npm : build` -> `npm: build`.

## v2.22.0

### What's New Features

- feat: implement TestController refreshHandler API by @Ricbet in https://github.com/opensumi/core/pull/1865
- feat: implement test item sort text api by @Ricbet in https://github.com/opensumi/core/pull/1877
- feat: support icons contribution point by @Aaaaash in https://github.com/opensumi/core/pull/1880
- feat: improve file search results order by @erha19 in https://github.com/opensumi/core/pull/1895
- feat: trigger editor find widget when no actived element by @Aaaaash in https://github.com/opensumi/core/pull/1980
- feat: support opentrs extension marketplace by @bk1012 in https://github.com/opensumi/core/pull/1933
- feat: support useVSCodeWorkspaceConfiguration config by @erha19 in https://github.com/opensumi/core/pull/1974
- feat: support more ActionButton icon expression by @erha19 in https://github.com/opensumi/core/pull/1986
- feat: support detect configuration change from the parent directory by @erha19 in https://github.com/opensumi/core/pull/1976
- feat: improve dirty diff by @Aaaaash in https://github.com/opensumi/core/pull/1978
- feat: support base64 icon on editor glyphMargin and treeview by @erha19 in https://github.com/opensumi/core/pull/2010
- feat: implement walkthroughs contribution API by @Ricbet in https://github.com/opensumi/core/pull/1902
- feat: diagnostic support display code href by @bytemain in https://github.com/opensumi/core/pull/2056
- feat: support submenus on editor/title by @erha19 in https://github.com/opensumi/core/pull/2088
- feat: optimize editor update content logic by @life2015 in https://github.com/opensumi/core/pull/2097
- feat: improve preference panel by @bytemain in https://github.com/opensumi/core/pull/2089
- feat: support markers status by @bytemain in https://github.com/opensumi/core/pull/2112
- feat: support space keybinding on file tree by @erha19 in https://github.com/opensumi/core/pull/2119
- feat: support toggle terminal keybinding by @erha19 in https://github.com/opensumi/core/pull/2130
- feat: improve file search path on workspace folders by @erha19 in https://github.com/opensumi/core/pull/2129
- feat: enable editor minimap by default by @Aaaaash in https://github.com/opensumi/core/pull/2127
- feat: implement 3-way prototyping code by @Ricbet in https://github.com/opensumi/core/pull/1960
- feat: support search and replace value by regexp by @erha19 in https://github.com/opensumi/core/pull/2138
- feat: update marketplace address by @bk1012 in https://github.com/opensumi/core/pull/2157
- feat: register debug editor decoration type when the browser is idle by @erha19 in https://github.com/opensumi/core/pull/2160
- feat: support get valid preference from service by @erha19 in https://github.com/opensumi/core/pull/2176
- feat: add more image types by @bytemain in https://github.com/opensumi/core/pull/2177
- feat: upgrade @parcel/watcher to support glob expression by @erha19 in https://github.com/opensumi/core/pull/2180
- feat(status-bar): do not display info icon if there is no info by @bytemain in https://github.com/opensumi/core/pull/2182
- feat: get file type by mime by @bytemain in https://github.com/opensumi/core/pull/2189

### Refactor

- refactor: remove package vscode-languageserver-protocol by @yantze in https://github.com/opensumi/core/pull/1988
- refactor: optimize scoped storage bootstrap speed by @erha19 in https://github.com/opensumi/core/pull/1997
- refactor: optimize bundle size of lite web ide by @erha19 in https://github.com/opensumi/core/pull/1953
- refactor: upgrade typescript version to 4.9.+ by @erha19 in https://github.com/opensumi/core/pull/1996
- refactor: remove scroll components by @erha19 in https://github.com/opensumi/core/pull/2093
- refactor: replace DeprecatedRecycleTree on the markers module by @erha19 in https://github.com/opensumi/core/pull/2099
- refactor: replace DeprecatedRecycleTree on Search view by @erha19 in https://github.com/opensumi/core/pull/2102
- refactor: remove DeprecatedRecycleTree on comment module by @erha19 in https://github.com/opensumi/core/pull/2109
- refactor: progressbar component by @Aaaaash in https://github.com/opensumi/core/pull/2114
- refactor: remove DeprecatedRecycleTree component by @erha19 in https://github.com/opensumi/core/pull/2111

### Style Changes

- style: improve debug toolbar z-index style by @erha19 in https://github.com/opensumi/core/pull/1965
- style: improve SCM delete decoration style by @erha19 in https://github.com/opensumi/core/pull/1963
- chore: improve image preview editor style by @Aaaaash in https://github.com/opensumi/core/pull/2020
- style: improve empty editor component style by @erha19 in https://github.com/opensumi/core/pull/2121
- fix: debug condition breakpoint style by @Ricbet in https://github.com/opensumi/core/pull/2141
- style: improve button overflow style by @erha19 in https://github.com/opensumi/core/pull/2161
- style: update the padding at the top/bottom of the popover component by @yantze in https://github.com/opensumi/core/pull/2175
- style: remove some useless tree style by @erha19 in https://github.com/opensumi/core/pull/2186

### Other Changes

- fix: code snippets prefix supports array by @shilin8805 in https://github.com/opensumi/core/pull/1891
- chore: use stable extension marketplace registry by @erha19 in https://github.com/opensumi/core/pull/1886
- chore: fix issue labeled by @erha19 in https://github.com/opensumi/core/pull/1905
- chore: update README and add CHANGELOG file by @erha19 in https://github.com/opensumi/core/pull/1904
- chore: fix issue labeled syntax error by @erha19 in https://github.com/opensumi/core/pull/1907
- chore: fix issue labeled config by @erha19 in https://github.com/opensumi/core/pull/1916
- test: add settings view test by @erha19 in https://github.com/opensumi/core/pull/1911
- test: add SCM e2e test by @erha19 in https://github.com/opensumi/core/pull/1934
- chore: add iconfont page deploy workflow by @erha19 in https://github.com/opensumi/core/pull/1944
- ci: use opensumi/actions by @bytemain in https://github.com/opensumi/core/pull/1946
- chore: add src into package files by @erha19 in https://github.com/opensumi/core/pull/1949
- fix: auto save opened file after replace all by @AEPKILL in https://github.com/opensumi/core/pull/1948
- chore: update iconfont page resources by @erha19 in https://github.com/opensumi/core/pull/1950
- build: use yarn workspace by @bytemain in https://github.com/opensumi/core/pull/1954
- chore: update lock file by @erha19 in https://github.com/opensumi/core/pull/2005
- fix: support onSaveCodeActions with ESLint extension by @erha19 in https://github.com/opensumi/core/pull/2023
- fix: use bash resolve shellpath by @Aaaaash in https://github.com/opensumi/core/pull/2021
- fix: progress codeAction when codeActionOnSave existed by @erha19 in https://github.com/opensumi/core/pull/2027
- fix: pause debug will not open stackframe source file by @Ricbet in https://github.com/opensumi/core/pull/2028
- chore: optimize default extension icon by @bk1012 in https://github.com/opensumi/core/pull/2030
- test: add layout e2e test by @erha19 in https://github.com/opensumi/core/pull/2044
- chore: fix web-lite and electron entry by @erha19 in https://github.com/opensumi/core/pull/2053
- chore: fail to start electron by @yantze in https://github.com/opensumi/core/pull/2057
- fix: electron cannot work by @bytemain in https://github.com/opensumi/core/pull/2060
- chore: remove errors from clipboard service by @erha19 in https://github.com/opensumi/core/pull/2054
- fix(extension): windows get globalStorageUri error by @bytemain in https://github.com/opensumi/core/pull/2068
- fix: debug on multiple processes by @erha19 in https://github.com/opensumi/core/pull/2080
- fix: new file with path on compress tree node by @erha19 in https://github.com/opensumi/core/pull/2084
- chore: update defualt theme by @Aaaaash in https://github.com/opensumi/core/pull/2087
- chore: update web lite sample link by @erha19 in https://github.com/opensumi/core/pull/2090
- fix: the tree node child maybe undefined by @erha19 in https://github.com/opensumi/core/pull/2096
- fix: create output editor when panel visible by @Aaaaash in https://github.com/opensumi/core/pull/2105
- fix: create debug console editor when panel visible by @Aaaaash in https://github.com/opensumi/core/pull/2106
- fix: update keybindings when keymap view rendered by @Aaaaash in https://github.com/opensumi/core/pull/2104
- fix: quick open argument by @Aaaaash in https://github.com/opensumi/core/pull/2117
- chore: fix unstable fileServiceClient unit test by @erha19 in https://github.com/opensumi/core/pull/2116
- fix: copy dir with recursive in rebuild-native script by @yantze in https://github.com/opensumi/core/pull/2122
- fix: webview cspSource by @Aaaaash in https://github.com/opensumi/core/pull/2120
- fix: save file diff error by @Aaaaash in https://github.com/opensumi/core/pull/2113
- fix: unnecessary re-tokenizer by @Aaaaash in https://github.com/opensumi/core/pull/2125
- chore: update opened editor group name by @erha19 in https://github.com/opensumi/core/pull/2118
- fix: search rules display logic by @erha19 in https://github.com/opensumi/core/pull/2124
- fix: disable some keybindings on file tree filter mode by @erha19 in https://github.com/opensumi/core/pull/2132
- fix: duplicate search results by @erha19 in https://github.com/opensumi/core/pull/2123
- fix: debounce editor layout by @Aaaaash in https://github.com/opensumi/core/pull/2134
- fix: unnecessary editor update options by @Aaaaash in https://github.com/opensumi/core/pull/2133
- fix: do not exclude .gitignore by @Aaaaash in https://github.com/opensumi/core/pull/2142
- chore: yarn lock by @Ricbet in https://github.com/opensumi/core/pull/2147
- build: update deps by @bytemain in https://github.com/opensumi/core/pull/2148
- test: add Javascript Debug Terminal test case by @erha19 in https://github.com/opensumi/core/pull/2150
- test: add search e2e test case by @erha19 in https://github.com/opensumi/core/pull/2149
- fix: highlight search content when ignoring case by @erha19 in https://github.com/opensumi/core/pull/2151
- test: add output panel e2e test case by @erha19 in https://github.com/opensumi/core/pull/2152
- chore(devtools): add sumi bin by @bytemain in https://github.com/opensumi/core/pull/2153
- chore: yarn lock by @Ricbet in https://github.com/opensumi/core/pull/2171
- fix: improve SCM experience on the workspace project by @erha19 in https://github.com/opensumi/core/pull/2168
- fix: merge editor conflict action error by @Ricbet in https://github.com/opensumi/core/pull/2163
- chore: update large file size limit by @erha19 in https://github.com/opensumi/core/pull/2162
- chore: update some logs on extension host process service by @erha19 in https://github.com/opensumi/core/pull/2173
- fix: prefix quick open should trim input by @bytemain in https://github.com/opensumi/core/pull/2172
- fix: improve regexp search ux by @erha19 in https://github.com/opensumi/core/pull/2185
- fix(editor): add missing edit stack when save by @bytemain in https://github.com/opensumi/core/pull/2192
- fix: settings.json should be JSONC by @bytemain in https://github.com/opensumi/core/pull/2181
- fix: support collaborationWsPath config by @Ricbet in https://github.com/opensumi/core/pull/2193
- fix: fix the marker outer area click error by @erha19 in https://github.com/opensumi/core/pull/2195
- fix: get valid preference value from the user scope by @erha19 in https://github.com/opensumi/core/pull/2196
- fix: create diff and merge editor as needed by @Aaaaash in https://github.com/opensumi/core/pull/2135

<a name="breaking_changes_2.22.0">[Breaking Changes:](#breaking_changes_2.22.0)</a>

#### 1. The `ClientApp` is no longer exported by `@opensumi/ide-core-browser`

We have removed the default export of `bootstrap/app.ts` in `@opensumi/ide-core-browser`. The `@opensumi/monaco-editor-core` in app.ts will cause a lot of memory leaks in the test code.

```diff
- import { ClientApp } from '@opensumi/ide-core-browser';
// Change to
+ import { ClientApp } from '@opensumi/ide-core-browser/lib/bootstrap/app';
```

#### 2. The `@opensumi/ide-userstorage` module has been permanently removed

If used, please remove this module, it has no practical effect.

#### 3. The `Scroll` component was removed

Please use `Scollerbars` component instead.

#### 4. The `DeprecatedRecycleTree` component was removed

Please use `RecycleTree` or `BasicRecycleTree` component instead.

#### 5. Revert to using `nsfw` watcher library in Linux

Because `parcel/watcher` has memory out-of-bounds access problem under Linux, which triggers sigsegv and causes crash, so `nsfw` is still used under Linux. https://github.com/parcel-bundler/watcher/issues/49

It is recommended to add dependencies globally:

```diff
+ "nsfw": "2.2.0"
```

At the same time, `nsfw` needs to be added back into the build，e.g `webpack.node.config.ts`

```diff
externals: [
  ({ context, request }, callback) => {
    if (['node-pty', '@parcel/watcher', 'spdlog', '@opensumi/vscode-ripgrep', 'vm2', 'keytar'].indexOf(request || '') !== -1) {
+   if (['node-pty', '@parcel/watcher', 'nsfw', 'spdlog', '@opensumi/vscode-ripgrep', 'vm2', 'keytar'].indexOf(request || '') !== -1) {
      return callback(undefined, `commonjs ${request}`);
    }
    callback();
  },
],
```

#### 6. Class And Path changed

1. FoldersPreferencesProvider -> FolderFilePreferenceProvider

```diff
- import { FolderPreferencesProvider } from '@opensumi/ide-preferences/lib/browser/folder-preferences-provider';
+ import { FolderFilePreferenceProvider } from '@opensumi/ide-preferences/lib/browser/folder-file-preference-provider';
```

2.  ParcelWatcherServer -> FileSystemWatcherServer

```diff
- import { ParcelWatcherServer } from '@opensumi/ide-file-service/lib/node/file-service-watcher';
+ import { FileSystemWatcherServer } from '@opensumi/ide-file-service/lib/node/file-service-watcher';
```

## v2.21.0

### What's New Features

- feat: improve workspaceService initialize speed by @life2015 in https://github.com/opensumi/core/pull/1824
- feat: support debug exception widget by @Ricbet in https://github.com/opensumi/core/pull/1828
- feat: improve bootstrap performance by @Aaaaash in https://github.com/opensumi/core/pull/1772
- feat: update watch exclude rule by @life2015 in https://github.com/opensumi/core/pull/1879
- feat: implement comment timestamp by @hacke2 in https://github.com/opensumi/core/pull/1595
- feat: terminal use webgl renderer by @Aaaaash in https://github.com/opensumi/core/pull/1653
- feat: implement InputBoxValidationMessage and InputBoxValidationSeverity by @hacke2 in https://github.com/opensumi/core/pull/1593
- feat: create files with options take the content by @samyzh in https://github.com/opensumi/core/pull/1648
- feat: support navigate editor history by mouse 3/4 by @erha19 in https://github.com/opensumi/core/pull/1663
- feat: support multi-person collaborative editing by @situ2001 in https://github.com/opensumi/core/pull/1274
- feat: Implementation of cross-end and cross-window file system service by @songhn233 in https://github.com/opensumi/core/pull/1594
- feat: capture Electron IPC messages for opensumi devtools by @tyn1998 in https://github.com/opensumi/core/pull/1583
- feat: support setting json glyphmargin edit by @Ricbet in https://github.com/opensumi/core/pull/1722
- feat: support quickopen render codicons by @Ricbet in https://github.com/opensumi/core/pull/1704
- feat: custom electron headerbar title compoment by @yantze in https://github.com/opensumi/core/pull/1730
- feat: implement quickpick kind api by @hacke2 in https://github.com/opensumi/core/pull/1673
- feat: support TreeView Drag API by @erha19 in https://github.com/opensumi/core/pull/1764
- feat: support move editor tabs over the tabbar by @erha19 in https://github.com/opensumi/core/pull/1671
- feat: support more menus on filetree filter mode by @erha19 in https://github.com/opensumi/core/pull/1785
- feat: support Git actionButton and improve style by @erha19 in https://github.com/opensumi/core/pull/1702
- feat: support set window title by @bytemain in https://github.com/opensumi/core/pull/1767
- feat: intranet resource config by @Ricbet in https://github.com/opensumi/core/pull/1808
- feat: migrate walk through snippets provider to file-scheme module by @Aaaaash in https://github.com/opensumi/core/pull/1340
- feat: support macos native dirty indicator by @bytemain in https://github.com/opensumi/core/pull/1773
- feat: update high contrast theme by @AhkunTa in https://github.com/opensumi/core/pull/1728

### Refactor

- refactor: parallel open resource by @Aaaaash in https://github.com/opensumi/core/pull/1873
- refactor: initialize the file tree without repetition by @Aaaaash in https://github.com/opensumi/core/pull/1874
- refactor: delay some time-consuming operations by @Aaaaash in https://github.com/opensumi/core/pull/1872
- refactor: optimize ajv load order by @yantze in https://github.com/opensumi/core/pull/1607
- refactor: add missing type for `file-service` by @situ2001 in https://github.com/opensumi/core/pull/1611

### Style Changes

- style: put resize handle hover line to the top by @erha19 in https://github.com/opensumi/core/pull/1852

### Other Changes

- fix: startup utils typo by @Ricbet in https://github.com/opensumi/core/pull/1685
- fix: revealInSideBar invalid by @Ricbet in https://github.com/opensumi/core/pull/1682
- fix: only handle scheme `file` on collaborative mode by @situ2001 in https://github.com/opensumi/core/pull/1709
- fix: change statusbar view when tooltip updated by @hacke2 in https://github.com/opensumi/core/pull/1712
- fix: recover deleted input selection style by @hacke2 in https://github.com/opensumi/core/pull/1719
- fix: file tree input validateMessage not hide by @Ricbet in https://github.com/opensumi/core/pull/1715
- fix: select option style in light mode by @hacke2 in https://github.com/opensumi/core/pull/1727
- fix: localEcho exclude program config type defense by @life2015 in https://github.com/opensumi/core/pull/1800
- fix: unified menubar background color by @bytemain in https://github.com/opensumi/core/pull/1812
- fix: run SCM actions with selected repo by @erha19 in https://github.com/opensumi/core/pull/1810
- fix: setDocumentEdited only in electron by @bytemain in https://github.com/opensumi/core/pull/1806
- fix: get correct unsaved files number by @erha19 in https://github.com/opensumi/core/pull/1827
- fix: support smart commit with 1.69.0 git extension by @erha19 in https://github.com/opensumi/core/pull/1805
- fix(search): arrow up key doesn't trigger search by @bytemain in https://github.com/opensumi/core/pull/1774
- fix: the preference markdown display with placeholder by @yantze in https://github.com/opensumi/core/pull/1854
- fix: improve extension installing UX and support unstall by @erha19 in https://github.com/opensumi/core/pull/1855
- fix: debug statck frame not update on the first stoped by @erha19 in https://github.com/opensumi/core/pull/1859
- fix: some event should not be dispose while switch session by @erha19 in https://github.com/opensumi/core/pull/1866
- fix: submenus show/hide rule by @Ricbet in https://github.com/opensumi/core/pull/1875
- fix: submenus error by @Aaaaash in https://github.com/opensumi/core/pull/1867
- test: implement run debug e2e test case by @Ricbet in https://github.com/opensumi/core/pull/1787
- test: add keymaps e2e test by @erha19 in https://github.com/opensumi/core/pull/1850
- test: get correct git decoration on filetree by @erha19 in https://github.com/opensumi/core/pull/1834
- test: filter files on the filetree by @erha19 in https://github.com/opensumi/core/pull/1835
- test: implement go to defination by cmd click by @Ricbet in https://github.com/opensumi/core/pull/1786
- test: add opened editor e2e test by @erha19 in https://github.com/opensumi/core/pull/1863
- test: improve e2e test stability and add terminal test case by @erha19 in https://github.com/opensumi/core/pull/1710
- test: add close all tabs test case by @Ricbet in https://github.com/opensumi/core/pull/1758
- test: implement file tree automatic location test case by @Ricbet in https://github.com/opensumi/core/pull/1765
- test: new file/folder from toolbar by @erha19 in https://github.com/opensumi/core/pull/1775
- chore: change filetree context menu order by @erha19 in https://github.com/opensumi/core/pull/1868
- chore(release): v2.20.10 by @erha19 in https://github.com/opensumi/core/pull/1876
- chore: add ui test retry times by @erha19 in https://github.com/opensumi/core/pull/1813
- chore(release): v2.20.7 by @erha19 in https://github.com/opensumi/core/pull/1815
- chore(release): v2.20.8 by @erha19 in https://github.com/opensumi/core/pull/1819
- chore: use GitHub release and auto labeled prs by @erha19 in https://github.com/opensumi/core/pull/1820
- chore: fix unstalable e2e test case by @erha19 in https://github.com/opensumi/core/pull/1825
- chore: fix decoration unit test by @erha19 in https://github.com/opensumi/core/pull/1823
- chore: update layout ids by @erha19 in https://github.com/opensumi/core/pull/1826
- chore(release): v2.20.9 by @Ricbet in https://github.com/opensumi/core/pull/1857
- chore: remove activityBar badge border by @yantze in https://github.com/opensumi/core/pull/1856
- chore: fix some commands i18n text by @erha19 in https://github.com/opensumi/core/pull/1847
- chore: update labels regex by @erha19 in https://github.com/opensumi/core/pull/1832
- chore: improve append view performance by @Aaaaash in https://github.com/opensumi/core/pull/1871
- chore: update view quick open prefix by @erha19 in https://github.com/opensumi/core/pull/1869
- chore: add issue labeled action by @erha19 in https://github.com/opensumi/core/pull/1781
- chore: update issue template labels by @erha19 in https://github.com/opensumi/core/pull/1793
- chore: broken actions while catching failure by @erha19 in https://github.com/opensumi/core/pull/1789
- chore: fix @opensumi/ide-collaboration module build by @erha19 in https://github.com/opensumi/core/pull/1699
- chore: improve terminal tab title by @Ricbet in https://github.com/opensumi/core/pull/1705
- chore: empty workspace notebook API implementation by @erha19 in https://github.com/opensumi/core/pull/1677
- ci: update actions by @bytemain in https://github.com/opensumi/core/pull/1776
- chore: remove useless component declaration by @erha19 in https://github.com/opensumi/core/pull/1782
- build: fix build by @bytemain in https://github.com/opensumi/core/pull/1759

<a name="breaking_changes_2.21.0">[Breaking Changes:](#breaking_changes_2.21.0)</a>

This version have not breaking changes.
