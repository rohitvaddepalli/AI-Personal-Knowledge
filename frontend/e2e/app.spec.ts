import { test, expect } from '@playwright/test';

test.describe('AI Personal Knowledge App - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');
  });

  test('should load the dashboard page', async ({ page }) => {
    // Wait for the page to load
    await expect(page).toHaveTitle(/Second Brain|AI Personal Knowledge/);
  });

  test('should navigate to notes page', async ({ page }) => {
    // Click on notes link or navigate
    await page.goto('http://localhost:3000/notes');
    await expect(page).toHaveURL(/.*\/notes/);
  });

  test('should create a new note', async ({ page }) => {
    // Navigate to new note page
    await page.goto('http://localhost:3000/notes/new');
    
    // Fill in the title
    await page.fill('input[placeholder="Note Title"]', 'Test Note');
    
    // Check that the editor is visible
    await expect(page.locator('.ProseMirror, textarea')).toBeVisible();
  });

  test('should display the knowledge graph', async ({ page }) => {
    await page.goto('http://localhost:3000/graph');
    // Check that the graph canvas or container exists
    await expect(page.locator('canvas, .force-graph-container')).toBeVisible();
  });

  test('should access settings page', async ({ page }) => {
    await page.goto('http://localhost:3000/settings');
    await expect(page).toHaveURL(/.*\/settings/);
  });
});
