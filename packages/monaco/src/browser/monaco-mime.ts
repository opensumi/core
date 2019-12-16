import { Injectable, Autowired } from '@ali/common-di';
import { IMimeService, CorePreferences, MimeAssociation } from '@ali/ide-core-browser';

@Injectable()
export class MonacoMimeService implements IMimeService {

  @Autowired(CorePreferences)
  corePreferences: CorePreferences;

  updateMime(): void {
    for (const association of this.getPreferenceFileAssociations()) {
      const mimetype = this.getMimeForMode(association.id) || `text/x-${association.id}`;
      monaco.mime.registerTextMime({ id: association.id, mime: mimetype, filepattern: association.filePattern, userConfigured: true }, true);
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
    return Object.keys(fileAssociations).map((filePattern) => ({ id: fileAssociations[filePattern], filePattern }));
  }
}
