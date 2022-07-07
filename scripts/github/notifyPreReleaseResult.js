const { createVersionText } = require('./helpers');

module.exports = async ({ github, context, core }) => {
  const issueBody = createVersionText('Pre-Release', process.env.CURRENT_VERSION, context);

  await github.rest.issues.createComment({
    issue_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo,
    body: issueBody,
  });
};
