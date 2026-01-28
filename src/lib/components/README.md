# Component Testing Note

Component testing for Svelte 5 with `@testing-library/svelte` is currently experiencing compatibility issues.

The Button.test.ts.disabled file demonstrates the testing pattern, but has been disabled until the testing library fully supports Svelte 5's runes mode.

For now, focus on:
- Unit tests for utilities and functions (working ✓)
- E2E tests with Playwright (working ✓)

Component tests will be re-enabled once testing library support improves.
