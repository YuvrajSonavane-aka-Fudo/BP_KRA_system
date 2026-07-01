# Commit Message Conventions

We follow the Conventional Commits specification. This leads to more readable messages that are easy to follow when looking through the project history.

## Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types

- **feat**: A new feature (correlates with MINOR in semantic versioning).
- **fix**: A bug fix (correlates with PATCH in semantic versioning).
- **docs**: Documentation only changes.
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc).
- **refactor**: A code change that neither fixes a bug nor adds a feature.
- **perf**: A code change that improves performance.
- **test**: Adding missing tests or correcting existing tests.
- **chore**: Changes to the build process or auxiliary tools and libraries.

## Examples

### Feature with scope
```
feat(formEngine): implement matrix block reordering

Added the ability to drag and drop matrix blocks alongside standard flexible fields by introducing the tableIndex state and updating the unified DndContext layout rendering.
```

### Bug fix
```
fix(flexible-editor): prevent table imports from acting as standard fields

Updated the import picker to properly route matrix tables to the schemaOverride instead of pushing them into the standard fields array.
```

## Best Practices
1. Use the imperative, present tense: "change" not "changed" nor "changes".
2. Do not capitalize the first letter of the description.
3. No dot (.) at the end of the description.
