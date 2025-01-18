export const defaultFilesWatcherExcludes = {
  '**/.git/objects/**': true,
  '**/.git/subtree-cache/**': true,
  '**/node_modules/**/*': true,
  '**/.hg/store/**': true,
};

export function flattenExcludes(fileExcludes: { [key: string]: boolean }) {
  const excludes: string[] = [];
  for (const key of Object.keys(fileExcludes)) {
    if (fileExcludes[key]) {
      excludes.push(key);
    }
  }
  return excludes;
}
