import axios from 'axios';

export interface LsifRequestParam {
  repository: string;
  commit: string;
  path: string;
  position: {
    character: number,
    line: number,
  };
}

const config = {
  headers: {
    'redcoast-client': 'vscode-lsif',
  },
};

export async function exists(repositoryPath: string | undefined, commit: string | undefined) {
  return axios.post(`/lsif/exist`, {
    'commit': commit,
    'repository': repositoryPath,
  }, config);
}

export async function hover(hoverParam: any) {
  return axios.post(`/lsif/hover`, {
    'commit': hoverParam.commit,
    'path': hoverParam.path,
    'position': {
      'character': hoverParam.character,
      'line': hoverParam.line,
    },
    'repository': hoverParam.repository,
  }, config);
}

export async function definition(definitionParam: any) {
  return axios.post(`/lsif/definition`, {
    'commit': definitionParam.commit,
    'path': definitionParam.path,
    'position': {
      'character': definitionParam.character,
      'line': definitionParam.line,
    },
    'repository': definitionParam.repository,
  }, config);
}

export async function reference(referenceParam: any) {
  return axios.post(`/lsif/references`, {
    'commit': referenceParam.commit,
    'path': referenceParam.path,
    'position': {
      'character': referenceParam.character,
      'line': referenceParam.line,
    },
    'repository': referenceParam.repository,
  }, config);
}
