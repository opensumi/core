import { Injectable, Autowired } from '@opensumi/di';
import { IMimeService, CorePreferences, MimeAssociation } from '@opensumi/ide-core-browser';
import { registerPlatformLanguageAssociation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/languagesAssociations';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

@Injectable()
export class MonacoMimeService implements IMimeService {
  @Autowired(CorePreferences)
  corePreferences: CorePreferences;

  updateMime(): void {
    for (const association of this.getPreferenceFileAssociations()) {
      const mimetype = this.getMimeForMode(association.id) || `text/x-${association.id}`;
      registerPlatformLanguageAssociation(
        { id: association.id, mime: mimetype, filepattern: association.filePattern },
        true,
      );
    }
  }

  protected getMimeForMode(langId: string): string | undefined {
    for (const language of monaco.languages.getLanguages()) {
      if (language.id === langId && language.mimetypes) {
        return language.mimetypes[0];
      }
    }
    return undefined;
  }

  protected getPreferenceFileAssociations(): MimeAssociation[] {
    const fileAssociations = this.corePreferences['files.associations'];
    if (!fileAssociations) {
      return [];
    }
    return Object.keys(fileAssociations).map((filePattern) => ({ id: fileAssociations[filePattern], filePattern }));
  }
}
