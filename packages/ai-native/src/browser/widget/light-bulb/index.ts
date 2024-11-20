// import { asClassNameArrayWrapper } from '@opensumi/ide-core-browser';
// import { Codicon, Sumicon } from '@opensumi/ide-core-common/lib/codicons';
// import { ThemeIcon } from '@opensumi/monaco-editor-core/esm/vs/base/common/themables';
// import {
//   LightBulbState,
//   LightBulbWidget,
// } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/codeAction/browser/lightBulbWidget';

// export class SumiLightBulbWidget extends LightBulbWidget {
//   protected override _updateLightBulbTitleAndIcon(): void {
//     this._domNode.classList.remove(...this._iconClasses);
//     this._iconClasses = [];
//     if (this.state.type !== LightBulbState.Type.Showing) {
//       return;
//     }
//     let icon: ThemeIcon;
//     let autoRun = false;
//     if (this.state.actions.allAIFixes) {
//       icon = Sumicon.magicWand;
//       if (this.state.actions.validActions.length === 1) {
//         autoRun = true;
//       }
//     } else if (this.state.actions.hasAutoFix) {
//       if (this.state.actions.hasAIFix) {
//         // icon = Codicon.lightbulbSparkleAutofix;
//         icon = Sumicon.magicWand;
//       } else {
//         icon = Codicon.lightbulbAutofix;
//       }
//     } else if (this.state.actions.hasAIFix) {
//       // icon = Codicon.lightbulbSparkle;
//       icon = Sumicon.magicWand;
//     } else {
//       icon = Codicon.lightBulb;
//     }
//     this._updateLightbulbTitle(this.state.actions.hasAutoFix, autoRun);
//     this._iconClasses = asClassNameArrayWrapper(icon);
//     this._domNode.classList.add(...this._iconClasses);
//   }
// }
