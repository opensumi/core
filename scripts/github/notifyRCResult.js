const { createVersionText } = require('./helpers');

module.exports = async ({ github, context, core }) => {
  const commentBody = createVersionText('Release Candidate', process.env.CURRENT_VERSION, context);

  await github.rest.repos.createCommitComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    body: commentBody,
    commit_sha: process.env.INPUT_REF,
  });
};
