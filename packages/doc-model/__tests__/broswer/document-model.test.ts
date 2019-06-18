import { Version, VersionType } from '@ali/ide-doc-model';
import { DocumentModel } from '@ali/ide-doc-model/lib/browser/doc-model';
import { IDocumentModelMirror } from '@ali/ide-doc-model/lib/common/doc';
import { URI } from '@ali/ide-core-common';

describe('document model test suite', () => {

  it('should be able to create document-model from mirror data', () => {

    const uri = new URI('scheme://somepath');
    const testString = 'test \n strings \n model \n content';

    const mirrorData: IDocumentModelMirror = {
      uri: uri.toString(),
      encoding: 'utf8',
      eol: '\n',
      language: 'typescript',
      lines: testString.split('\n'),
      base: Version.init(VersionType.browser),
    };

    const documentModel = DocumentModel.fromMirror(mirrorData);

    expect(documentModel.encoding).toEqual(mirrorData.encoding);
    expect(documentModel.eol).toEqual(mirrorData.eol);
    expect(documentModel.language).toEqual(mirrorData.language);
    expect(documentModel.lines.join(documentModel.eol)).toEqual((mirrorData.lines as string[]).join(mirrorData.eol));
    expect(documentModel.uri.toString()).toEqual(mirrorData.uri);

  });

});
