# Contributing to TechScribe

Thank you for considering contributing to TechScribe! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Assume good intentions
- Help maintain a welcoming environment

## Getting Started

### Prerequisites

- Node.js 22+
- Docker + Docker Compose
- Git
- A code editor (VS Code recommended)

### Initial Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/techscribe.git
   cd techscribe
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

5. Start the database:
   ```bash
   docker compose up db -d
   ```

6. Run migrations:
   ```bash
   npm run db:migrate
   ```

7. Seed the database (optional):
   ```bash
   npm run db:seed
   ```

8. Start the development server:
   ```bash
   npm run dev
   ```

## Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Test your changes** thoroughly

4. **Commit your changes** following our commit guidelines

5. **Push to your fork**:
   ```bash
   git push origin feat/your-feature-name
   ```

6. **Open a Pull Request** against the `main` branch

## Coding Standards

### TypeScript

- **Strict mode enabled**: No implicit `any`
- **No `any` types**: Use proper typing or `unknown` with type guards
- **Prefer const**: Use `const` for variables that won't be reassigned
- **Functional patterns**: Prefer pure functions where possible

### React/Next.js

- **Server Components by default**: Use `"use client"` only when needed
- **Async Server Components**: Leverage async/await in Server Components
- **Proper data fetching**: Fetch at the component level, not in parent
- **Error boundaries**: Handle errors appropriately

### File Naming

- Components: `PascalCase.tsx`
- Utilities: `kebab-case.ts`
- API routes: `route.ts`
- Pages: `page.tsx`

### Code Organization

```
app/
  (route-group)/     # Route groups for shared layouts
  api/               # API routes
  actions/           # Server actions
components/          # Reusable UI components
lib/                 # Utility functions and shared logic
prisma/              # Database schema and migrations
```

### Styling

- Use Tailwind CSS classes
- Follow mobile-first responsive design
- Keep class lists readable (use line breaks for long lists)
- Use semantic color names from theme

### Database

- **Always use transactions** for multi-step operations
- **Index frequently queried fields**
- **Use proper relations**: Cascade deletes where appropriate
- **Migrations**: Never edit existing migrations, create new ones

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `chore`: Build process or auxiliary tool changes
- `docs`: Documentation only
- `style`: Code style changes (formatting, missing semi-colons, etc.)
- `test`: Adding or updating tests

### Examples

```bash
feat(articles): add member-only article support

- Add memberOnly field to Article model
- Implement paywall logic in article page
- Add free article quota tracking

Closes #42
```

```bash
fix(auth): prevent oauth signup without turnstile verification

The oauth callback was not checking for turnstile token.
Now returns 403 if token is missing or invalid.
```

### Rules

- Use imperative mood ("add feature" not "added feature")
- Don't capitalize first letter of subject
- No period at the end of subject
- Keep subject line under 50 characters
- Wrap body at 72 characters
- Reference issues in footer

## Pull Request Process

### Before Submitting

1. ✅ Code follows our style guidelines
2. ✅ TypeScript compiles without errors
3. ✅ No linting errors (`npm run lint`)
4. ✅ Database migrations work (`npm run db:migrate`)
5. ✅ Changes are tested locally
6. ✅ Commit messages follow conventions
7. ✅ Branch is up to date with `main`

### PR Title

Use the same format as commit messages:
```
feat(scope): description
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How to test the changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex logic
- [ ] Updated documentation
- [ ] No new warnings
- [ ] Database migrations tested
```

### Review Process

1. Maintainers will review your PR
2. Address any requested changes
3. Once approved, a maintainer will merge

### After Merge

- Delete your feature branch
- Pull latest `main` for your next contribution

## Testing

### Manual Testing Checklist

For features, test:
- ✅ Happy path works as expected
- ✅ Error cases are handled gracefully
- ✅ Edge cases are considered
- ✅ UI is responsive on mobile and desktop
- ✅ Works in both light and dark mode (if applicable)
- ✅ No console errors or warnings

### Database Testing

When changing schema:
- ✅ Migration can be applied to empty database
- ✅ Migration can be applied to existing database
- ✅ Rollback works (if needed)
- ✅ No data loss on existing records

### API Testing

For API routes:
- ✅ Returns correct status codes
- ✅ Validates input properly
- ✅ Handles authentication/authorization
- ✅ Returns properly typed responses
- ✅ Handles errors gracefully

## Questions?

- Check existing issues and discussions
- Open a new issue for bugs or feature requests
- Ask questions in discussions

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
