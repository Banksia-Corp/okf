# Contributing to @banksia/okf

Thank you for your interest in contributing to the Open Knowledge Format (`@banksia/okf`)!

## Development Setup

### Prerequisites

- **Node.js**: `v24.x` (see `.node-version` or `.nvmrc`)
- **Package Manager**: `pnpm@10.28.0` (managed via Corepack or standalone install)

### Initializing the Project

```bash
# Clone the repository
git clone https://github.com/Banksia-Corp/okf.git
cd okf

# Install dependencies and set up hooks
pnpm install
```

## Branch & Workflow Guidelines

1. **GitHub Issues**: Always associate work with an existing GitHub issue or create one prior to making changes.
2. **Branch Naming**:
   - `feature/<issue-number>-<short-description>`
   - `fix/<issue-number>-<short-description>`
   - `chore/<issue-number>-<short-description>`
3. **Commit Messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat(...)`: New features
   - `fix(...)`: Bug fixes
   - `docs(...)`: Documentation updates
   - `chore(...)`: Maintenance, dependencies, tooling
4. **Pre-commit Hooks**: `lefthook` runs automatically on `git commit` to verify formatting and linting.

## Quality Gates

Before opening a pull request, ensure all checks pass:

```bash
# Verify linting
pnpm run lint

# Auto-fix formatting
pnpm run format
```

## Pull Request Process

1. Open a pull request against the `main` branch.
2. Fill out the PR template describing changes, related issues, and testing notes.
3. Ensure CI passes and request review from the repository maintainers.
