import { Path } from './path';
import { isWindows } from './platform';
import { URI, Uri } from './uri';

export namespace FileUri {
  const windowsDriveRegex = /^([^:/?#]+?):$/;

  /**
   * Creates a new file URI from the filesystem path argument.
   * @param fsPath the filesystem path.
   */
  export function create(_fsPath: string) {
    return new URI(Uri.file(_fsPath));
  }

  /**
   * Returns with the platform specific FS path that is represented by the URI argument.
   *
   * @param uri the file URI that has to be resolved to a platform specific FS path.
   */
  export function fsPath(uri: URI | string): string {
    if (typeof uri === 'string') {
      return fsPath(new URI(uri));
    } else {
      return uriToFsPath(uri.codeUri);
    }
  }

  export function uriToFsPath(uri: Uri): string {
    /*
     * A uri for the root of a Windows drive, eg file:\\\c%3A, is converted to c:
     * by the Uri class.  However file:\\\c%3A is unambiguously a uri to the root of
     * the drive and c: is interpreted as the default directory for the c drive
     * (by, for example, the readdir function in the fs-extra module).
     * A backslash must be appended to the drive, eg c:\, to ensure the correct path.
     */
    const fsPathFromVsCodeUri = uri.fsPath;
    if (isWindows) {
      const isWindowsDriveRoot = windowsDriveRegex.exec(fsPathFromVsCodeUri);
      if (isWindowsDriveRoot) {
        return fsPathFromVsCodeUri + '\\';
      }
    }
    return fsPathFromVsCodeUri;
  }

  export function isEqualOrParent(base: Uri, parentCandidate: Uri): boolean {
    if (base.scheme !== parentCandidate.scheme || base.authority !== parentCandidate.authority) {
      return false;
    }

    const basePath = new Path(uriToFsPath(base));
    const parentCandidatePath = new Path(uriToFsPath(parentCandidate));

    return basePath.isEqualOrParent(parentCandidatePath);
  }
}
