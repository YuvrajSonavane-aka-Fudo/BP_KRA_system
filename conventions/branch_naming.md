# Git Branch Naming Conventions

Based on standard Git best practices, a consistent branch naming convention provides clarity about the work done in a specific branch and makes it easier to locate a particular branch in a repository.

## Basic Rules
- **Lowercase and Hyphen-separated:** Stick to lowercase for branch names and use hyphens to separate words.
- **Alphanumeric Characters:** Use only alphanumeric characters (a-z, A-Z, 0-9) and hyphens. Avoid punctuation, spaces, underscores, or any non-alphanumeric character.
- **No Continuous Hyphens:** Do not use continuous hyphens (e.g., `feature--new-login` is bad).
- **No Trailing Hyphens:** Do not end your branch name with a hyphen.
- **Descriptive:** The name should be descriptive and concise, reflecting the work done.

## Branch Types and Prefixes

### 1. Feature Branches
Used for developing new features.
- **Prefix:** `feature/`
- **Examples:**
  - `feature/login-system`
  - `feature/user-authentication`
- **With Ticket Number (e.g., Jira):**
  - `feature/T-123-new-login-system`
  - `feature/T-456-user-authentication`

### 2. Bugfix Branches
Used to fix bugs in the code (usually non-critical or during development/testing).
- **Prefix:** `bugfix/`
- **Examples:**
  - `bugfix/header-styling`
  - `bugfix/cart-calculation-error`
- **With Ticket Number:**
  - `bugfix/T-789-fix-header-styling`

### 3. Hotfix Branches
Made directly from the production branch to fix critical bugs in the production environment.
- **Prefix:** `hotfix/`
- **Examples:**
  - `hotfix/critical-security-issue`
  - `hotfix/payment-gateway-crash`
- **With Ticket Number:**
  - `hotfix/T-321-security-patch`

### 4. Release Branches
Used to prepare for a new production release. They allow for last-minute dotting of i's and crossing t's.
- **Prefix:** `release/`
- **Examples:**
  - `release/v1.0.1`
  - `release/v2.0.1`

### 5. Documentation Branches
Used to write, update, or fix documentation (e.g., the README.md file).
- **Prefix:** `docs/`
- **Examples:**
  - `docs/api-endpoints`
  - `docs/installation-guide`
- **With Ticket Number:**
  - `docs/T-654-update-readme`
