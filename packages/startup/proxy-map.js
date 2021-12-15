const SCM_PLATFORM = process.env.SCM_PLATFORM;

const SCM_API_HOST = SCM_PLATFORM === 'aone' ? 'https://code.aone.alibaba-inc.com' : 'https://code.alipay.com';

const PRIVATE_TOKEN = SCM_PLATFORM === 'aone' ? process.env.AONECODE_SK : process.env.ANTCODE_SK;

const COMMON_HEADERS = {
  'private-token': PRIVATE_TOKEN,
  host: SCM_API_HOST.slice(8),
  origin: SCM_API_HOST,
};

const treeApiRegex = /^\/code-service\/projects\/(.+)\/repository\/tree/;

module.exports = {
  '/code-service': {
    target: SCM_API_HOST,
    changeOrigin: true,
    pathRewrite: (path) => {
      if (treeApiRegex.test(path)) {
        // tree 接口 aone 和 antcode 的不太一样
        return path.replace(
          treeApiRegex,
          (_, p1) => `/api/${SCM_PLATFORM === 'aone' ? 'v4' : 'v3'}/projects/${p1}/repository/tree`,
        );
      }
      return path.replace(/^\/code-service/, () => '/api');
    },
    headers: {
      ...COMMON_HEADERS,
    },
    logLevel: 'debug',
  },
  '/lsif': {
    target: process.env.LSIF_HOST || '',
    changeOrigin: true,
    pathRewrite: {
      '^/lsif': '/api/lsif',
    },
  },
  '/asset-service': {
    target: SCM_API_HOST,
    changeOrigin: true,
    pathRewrite: {
      '^/asset-service': '/api',
    },
    headers: {
      ...COMMON_HEADERS,
    },
  },
};
