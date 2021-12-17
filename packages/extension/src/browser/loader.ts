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
      const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(js)}`;
      return url;
    }
  }
  return scriptPath;
}
