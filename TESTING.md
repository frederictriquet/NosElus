# Testing Guide

This project includes comprehensive testing infrastructure for both unit and E2E testing.

## Testing Stack

- **Unit Tests**: Vitest + Testing Library
- **E2E Tests**: Playwright
- **DOM Environment**: Happy-DOM

## Project Structure

```
src/
├── lib/
│   ├── components/        # Reusable components
│   │   └── Button.svelte  # Example component
│   └── utils.ts           # Utility functions
├── tests/
│   └── setup.ts           # Test setup and configuration
tests/
└── e2e/                   # End-to-end tests
    ├── home.test.ts       # Homepage tests
    └── navigation.test.ts # Navigation tests
```

## Running Tests

### Unit Tests

```bash
# Run all unit tests once
npm run test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with UI dashboard
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with interactive UI
npm run test:e2e:ui

# Run E2E tests in debug mode
npm run test:e2e:debug
```

### Run All Tests

```bash
# Run both unit and E2E tests
npm run test:all
```

## Writing Tests

### Unit Tests

Create test files alongside your source code with `.test.ts` or `.spec.ts` extension:

```typescript
// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from './utils';

describe('myFunction', () => {
	it('should do something', () => {
		expect(myFunction()).toBe(expected);
	});
});
```

### E2E Tests

Create test files in `tests/e2e/` directory:

```typescript
// tests/e2e/feature.test.ts
import { expect, test } from '@playwright/test';

test.describe('Feature Name', () => {
	test('should work correctly', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1')).toBeVisible();
	});
});
```

## Test Configuration

### Vitest Config

Located in `vitest.config.ts`:
- Uses Happy-DOM for fast DOM simulation
- Includes test setup from `src/tests/setup.ts`
- Configured for SvelteKit integration
- Coverage reports in text, JSON, and HTML formats

### Playwright Config

Located in `playwright.config.ts`:
- Automatically builds and starts preview server
- Takes screenshots on failure
- Records video on failure
- Runs on http://localhost:4173

## Current Test Coverage

### Unit Tests
- ✅ Utility functions (date/time formatting, comparisons)
- ⚠️ Component tests (disabled due to Svelte 5 compatibility - see below)

### E2E Tests
- ✅ Homepage loading and structure
- ✅ Footer with build timestamp
- ✅ Navigation
- ✅ Console error detection
- ✅ Viewport configuration

## Known Limitations

### Component Testing

Component testing with `@testing-library/svelte` is currently experiencing compatibility issues with Svelte 5's runes mode. Component tests are temporarily disabled (`.test.ts.disabled` files).

**Workaround Options:**
1. Use E2E tests with Playwright for component behavior testing
2. Wait for testing library updates with full Svelte 5 support
3. Test component logic separately from rendering

## Best Practices

1. **Test Organization**: Group related tests with `describe()` blocks
2. **Test Names**: Use clear, descriptive test names that explain what's being tested
3. **Isolation**: Each test should be independent and not rely on other tests
4. **Cleanup**: Tests automatically cleanup after each run via `src/tests/setup.ts`
5. **Async Operations**: Always use `await` for async operations in E2E tests

## Continuous Integration

Tests are designed to run in CI environments:
- Playwright configured with `forbidOnly: !!process.env.CI`
- Automatic retries in CI: 2 retries for E2E tests
- Serial execution in CI for stability

## Debugging

### Unit Tests
```bash
# Run specific test file
npm run test src/lib/utils.test.ts

# Run with UI for interactive debugging
npm run test:ui
```

### E2E Tests
```bash
# Debug mode opens browser and pauses on failures
npm run test:e2e:debug

# Run specific test file
npx playwright test tests/e2e/home.test.ts
```

## Coverage Reports

After running `npm run test:coverage`, view the HTML report:
```bash
open coverage/index.html
```

Coverage reports exclude:
- Node modules
- Test files
- Type definitions
- Config files
- Mock data
- Build artifacts

## Future Improvements

- [ ] Re-enable component tests when Svelte 5 support improves
- [ ] Add visual regression testing
- [ ] Add API mocking for integration tests
- [ ] Add performance testing
- [ ] Increase E2E test coverage for future features
