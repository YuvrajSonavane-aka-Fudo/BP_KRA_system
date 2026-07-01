# Pull Request (PR) Conventions

A well-structured Pull Request description speeds up code reviews, ensures that context is not lost over time, and makes it easier for QA and fellow developers to understand what changes have been made and why.

## Basic Structure of a PR

A good PR description typically contains the following elements:
1. **Title:** Clear, concise, and ideally follows the same convention as commit messages (e.g., `feat: add user authentication`).
2. **Summary:** A brief overview of what problem this PR solves or what feature it introduces.
3. **Linked Tickets:** References to Jira/Trello/GitHub issues (e.g., "Closes #123").
4. **Changes Made:** A bulleted list of high-level technical or UI changes made in the code.
5. **How to Test:** Clear, step-by-step instructions on how a reviewer or QA can test these changes locally.
6. **Screenshots/Videos:** Highly recommended if the PR includes UI/visual changes.

## Sample Pull Request Template

You can copy and paste this structure when creating your next Pull Request:

```markdown
## Summary
*Provide a brief explanation of what this PR does. What is the business value or technical necessity?*

## Linked Issue
Closes TICKET-123

## Changes Made
- Added a new `AuthService` class to handle JWT token generation.
- Updated the Login UI component to include a "Remember Me" checkbox.
- Refactored `UserController` to utilize the new authentication flow.

## How to Test
1. Check out this branch locally: `git checkout feat/TICKET-123-auth`
2. Start the backend and frontend servers.
3. Navigate to `http://localhost:3000/login`.
4. Enter test credentials (`test@example.com` / `password123`) and check the "Remember Me" box.
5. Verify that upon successful login, a `refreshToken` is saved in your browser's Local Storage.

## Screenshots (if applicable)
| Before | After |
|--------|-------|
| [Image 1] | [Image 2] |

## Checklist
- [x] Code compiles and runs correctly.
- [x] Linter passes with no warnings.
- [x] Unit tests have been added/updated.
- [x] Documentation has been updated.
```

## Best Practices
- **Keep PRs Small:** Try to limit your PR to a single feature, bug fix, or refactor. Large PRs are harder to review and more prone to bugs.
- **Review Your Own Code First:** Before assigning reviewers, look through your own diff to catch accidental console.logs, commented-out code, or formatting issues.
- **Use Draft PRs:** If you want feedback early on a work-in-progress, open a "Draft PR" and explicitly ask for the kind of feedback you need.
