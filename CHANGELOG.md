# Changelog

> For some reason, in v2.x.y version, there may also be a Break Change in the x-bit.

## History

- [Previous Changelogs](https://github.com/opensumi/core/releases)
- [Previous Breaking Changes](https://github.com/opensumi/core/wiki/Breaking-Changes)

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
