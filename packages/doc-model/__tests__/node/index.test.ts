import { DocModelModule } from '../../src/node';
import { createNodeInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { FileServiceModule } from '@ali/ide-file-service/lib/node';
import { NodeDocumentService } from '@ali/ide-doc-model/lib/node/doc-model';
import { tmpdir } from 'os';
import { writeFileSync, fstat, readFileSync } from 'fs';
import { join } from 'path';
import { URI } from '@ali/ide-core-common';
import { IDocumentModelMirror } from '@ali/ide-doc-model/lib/common/doc';

describe('node model service test', () => {

  it('should be able to get modelService', () => {
    const injector = createNodeInjector([DocModelModule, FileServiceModule]);
    expect(injector.get(NodeDocumentService)).not.toBeUndefined();
  });

  it ('should be able to resolve content with \'file\' schema', async (done) => {
    const injector = createNodeInjector([DocModelModule, FileServiceModule]);
    const service = injector.get(NodeDocumentService);

    const tmpfile = join(tmpdir(), 'ktTest.' + Date.now() + '.js');

    writeFileSync(tmpfile, 'temp content', 'utf8');

    const mirror = await service.resolveContent(URI.file(tmpfile)) as IDocumentModelMirror;

    expect(mirror.lines.join(mirror.eol)).toEqual('temp content');
    expect(mirror.language).toEqual('javascript');

    done();
  });

  it ('should be able to save content', async (done) => {
    const injector = createNodeInjector([DocModelModule, FileServiceModule]);
    const service = injector.get(NodeDocumentService);
    const tmpfile = join(tmpdir(), 'ktTest2.' + Date.now() + '.js');

    writeFileSync(tmpfile, 'temp content 2', 'utf8');

    const mirror = await service.resolveContent(URI.file(tmpfile)) as IDocumentModelMirror;

    expect(mirror.lines.join(mirror.eol)).toEqual('temp content 2');
    expect(mirror.language).toEqual('javascript');

    mirror.lines[0] = 'saved content';

    const saved = await service.saveContent(mirror);

    expect(saved).toBeTruthy();

    expect(readFileSync(tmpfile, 'utf8').toString()).toEqual(mirror.lines.join(mirror.eol));

    done();
  });

});
