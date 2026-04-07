```markdown
# chorus Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns and conventions used in the `chorus` TypeScript codebase. You'll learn how to structure files, write and organize code, and follow the project's unique style for imports, exports, and testing. This guide is ideal for contributors looking to maintain consistency and quality in their work.

## Coding Conventions

### File Naming
- **Pattern:** PascalCase
- **Example:**  
  ```plaintext
  UserProfile.ts
  AudioEngine.ts
  ```

### Import Style
- **Pattern:** Relative imports
- **Example:**
  ```typescript
  import { AudioEngine } from './AudioEngine';
  import { UserProfile } from '../models/UserProfile';
  ```

### Export Style
- **Pattern:** Named exports
- **Example:**
  ```typescript
  // In AudioEngine.ts
  export function startEngine() { ... }
  export const ENGINE_VERSION = '1.0.0';
  ```

### Commit Patterns
- **Type:** Freeform (no enforced prefix)
- **Average Length:** ~52 characters
- **Example:**
  ```
  Fix bug in audio playback when switching tracks
  Add user profile settings modal
  ```

## Workflows

### Adding a New Feature
**Trigger:** When implementing a new feature or module  
**Command:** `/add-feature`

1. Create a new file using PascalCase (e.g., `NewFeature.ts`).
2. Use relative imports to include dependencies.
3. Export all functions, classes, or constants using named exports.
4. Write a corresponding test file (`NewFeature.test.ts`).
5. Commit changes with a clear, descriptive message.

### Writing Tests
**Trigger:** When adding or updating code that needs test coverage  
**Command:** `/write-test`

1. Create a test file named with the pattern `*.test.ts` (e.g., `AudioEngine.test.ts`).
2. Place test files alongside or near the code under test.
3. Use the project's preferred (undetected) testing framework syntax.
4. Run tests to ensure correctness before committing.

### Refactoring Code
**Trigger:** When improving or restructuring existing code  
**Command:** `/refactor`

1. Update file and symbol names to follow PascalCase and named exports.
2. Change imports to use relative paths if not already.
3. Update or add tests as needed.
4. Commit with a descriptive message about the refactor.

## Testing Patterns

- **Test File Naming:** Use the pattern `*.test.ts` for test files.
- **Location:** Place test files alongside the module they test.
- **Framework:** Not explicitly detected; follow existing patterns in the codebase.
- **Example:**
  ```typescript
  // AudioEngine.test.ts
  import { startEngine } from './AudioEngine';

  test('startEngine initializes correctly', () => {
    expect(startEngine()).toBe(true);
  });
  ```

## Commands
| Command       | Purpose                                      |
|---------------|----------------------------------------------|
| /add-feature  | Scaffold and implement a new feature/module  |
| /write-test   | Create and run tests for your code           |
| /refactor     | Refactor code to follow project conventions  |
```
