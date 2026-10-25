## Description

<!-- Brief description of the changes -->

## Type of Change

<!-- Mark with an `x` -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring
- [ ] Dependency update

## Related Issues

<!-- Link to related issues, e.g., "Closes #123" -->

## Changes Made

<!-- Detailed list of changes -->

- 
- 
- 

## Testing

<!-- Describe how you tested your changes -->

### Automated checks

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run test:integration` (when touching auth, the paywall, export/erasure, the proxy or migrations)

### Manual checks

- [ ] Tested the affected flows in `./start.sh`
- [ ] Phone and desktop widths; light, dark and sand themes
- [ ] No console errors or warnings
- [ ] Sign-in, account setup and permissions still behave as expected

### Database changes

- [ ] Migration included and applies to an empty and an existing database
- [ ] No data loss on existing records
- [ ] New user-owned data cascades on user delete and is included in `/api/me/export`
- [ ] Indexes added for new foreign keys and frequent filters

## Screenshots

<!-- If applicable, add screenshots -->

## Checklist

- [ ] I have performed a self-review of my code
- [ ] The change is limited to what the PR describes
- [ ] Tests cover the new behaviour or the fixed bug
- [ ] No secrets, `.env` files or real user data are committed
- [ ] `API.md` updated for new or changed endpoints
- [ ] `SECURITY.md` updated for new or changed security controls
- [ ] `.env.example` and `DEPLOY.md` updated for new environment variables
- [ ] `CHANGELOG.md` updated under `[Unreleased]`

## Additional Notes

<!-- Any additional information for reviewers -->

## For Reviewers

<!-- Specific areas you'd like reviewers to focus on -->
