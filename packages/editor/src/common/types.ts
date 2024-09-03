import * as monaco from '@opensumi/ide-monaco';

export interface IDocModelUpdateOptions extends monaco.editor.ITextModelUpdateOptions {
  detectIndentation?: boolean;
}
