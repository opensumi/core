export function getRepoFiles(projectId: string, ref: string, path?: string) {
  return fetch(
    `/code-service/projects/${projectId}/repository/tree?ref_name=${ref}&type=direct${path ? `&path=${path}` : ''}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  ).then((res) => res.json());
}
