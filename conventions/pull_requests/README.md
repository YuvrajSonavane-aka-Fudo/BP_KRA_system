# Pull Request Conventions

A well-structured Pull Request (PR) helps reviewers understand your changes quickly and ensures a smooth review process.

## PR Title Format

Use the same Conventional Commits format as your commits for the PR title:
`<type>[optional scope]: <description>`

**Example:** `feat(formEngine): implement matrix block reordering`

## PR Description Template

Please include the following sections in your PR description:

```markdown
## Objective
Briefly describe the purpose of this PR. What problem does it solve or what feature does it add?

## Changes
List the key changes made in this PR.
- Added `tableIndex` state to `FlexibleFieldEditor.jsx`.
- Unified `DndContext` wrappers to allow intermingling of matrix components and standard fields.
- Updated `SortableCard.jsx` to dynamically render fields around the matrix.

## Testing
Describe how you tested these changes.
- Added automated TDD specs in `flexibleFieldEditor.test.jsx`.
- Verified all 588 regression tests pass.
- Manually tested drag-and-drop within the UI.

## Related Issues
Link to any related tickets or issues (e.g., Closes #123).
```

## Best Practices
1. **Keep it focused:** A PR should address a single concern or feature.
2. **Review your own code first:** Check for styling issues, console logs, or commented-out code.
3. **Include screenshots:** If the PR includes UI changes, attach screenshots or a screen recording to demonstrate the visual changes.
