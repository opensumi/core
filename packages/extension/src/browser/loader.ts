export function getWorkerBootstrapUrl(scriptPath: string, label: string, ignoreCors?: boolean): string {
  if (ignoreCors) {
    return scriptPath;
  }

  if (/^(http:)|(https:)|(file:)/.test(scriptPath)) {
    const currentUrl = String(window.location);
    const currentOrigin = currentUrl.substr(
      0,
      currentUrl.length - window.location.hash.length - window.location.search.length - window.location.pathname.length,
    );
    if (scriptPath.substring(0, currentOrigin.length) !== currentOrigin) {
      const js = `/*${label}*/importScripts('${scriptPath}');/*${label}*/`;
      const blob = new Blob([js], { type: 'application/javascript' });
      return URL.createObjectURL(blob);
    }
  }
  return scriptPath;
}
