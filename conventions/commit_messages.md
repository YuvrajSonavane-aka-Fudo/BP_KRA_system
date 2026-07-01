# Git Commit Message Conventions

Following a consistent commit message convention (such as [Conventional Commits](https://www.conventionalcommits.org/)) helps to maintain a clean and understandable project history, automates release notes generation, and simplifies code reviews.

## Basic Structure
A standard commit message should be structured as follows:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Commit Types
Use one of the following prefixes to indicate the intent of the commit:

- **`feat:`** A new feature for the user.
- **`fix:`** A bug fix for the user.
- **`docs:`** Changes to the documentation only (e.g., README.md, code comments).
- **`style:`** Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc).
- **`refactor:`** A code change that neither fixes a bug nor adds a feature.
- **`perf:`** A code change that improves performance.
- **`test:`** Adding missing tests or correcting existing tests.
- **`chore:`** Changes to the build process or auxiliary tools and libraries (e.g., updating dependencies).

## Rules and Best Practices
1. **Use the imperative mood in the subject line:** "add feature" not "added feature" or "adds feature".
2. **Limit subject line length:** Keep the subject line under 50-72 characters.
3. **No trailing period:** Do not end the subject line with a period.
4. **Use the body to explain *what* and *why*, not *how*:** The code itself shows how; the commit message should explain the reasoning behind the change. Separate the body from the subject with a blank line.

## Sample Names and Examples

### Feature Commit
```text
feat(auth): add google oauth login support

Added a new "Sign in with Google" button on the login screen to allow users to authenticate using their Google accounts.
```

### Bugfix Commit
```text
fix(cart): resolve incorrect total calculation on checkout

The cart total was not factoring in the bulk discount properly. Updated the calculation logic in `CartService`.

Fixes #123
```

### Documentation Commit
```text
docs: update API setup instructions in README
```

### Chore/Maintenance Commit
```text
chore(deps): bump react from 18.2.0 to 18.3.0
```

### Breaking Change
To indicate a breaking change, add an `!` after the type/scope or include `BREAKING CHANGE:` in the footer.
```text
feat(api)!: remove deprecated v1 user endpoints

BREAKING CHANGE: All integrations must now migrate to the v2 user endpoints as v1 has been completely removed.
```
