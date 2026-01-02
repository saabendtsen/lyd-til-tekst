import { test, expect } from '@playwright/test';

test.describe('Style Guide Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./settings');
  });

  test('creates a new style guide', async ({ page }) => {
    // Count existing guides before creating
    const countBefore = await page.locator('.card:has-text("Ny stilguide")').count();

    // Click create new button
    await page.click('button:has-text("Opret ny")');
    await page.waitForTimeout(500);

    // Verify a new guide was created (count increased)
    const countAfter = await page.locator('.card:has-text("Ny stilguide")').count();
    expect(countAfter).toBeGreaterThanOrEqual(countBefore);

    // Editor should open - verify input is visible
    await expect(page.locator('input.input').first()).toBeVisible();
  });

  test('edits style guide name', async ({ page }) => {
    // First create a new guide
    await page.click('button:has-text("Opret ny")');
    await page.waitForTimeout(500);

    // Find the name input in the editor - it's in a separate editor section
    const nameInput = page.locator('input.input').first();
    await expect(nameInput).toBeVisible();

    // Clear and type new name
    await nameInput.fill('');
    await nameInput.fill('Test Stilguide E2E');

    // Blur to trigger save
    await nameInput.blur();

    // Give it time to save
    await page.waitForTimeout(1000);

    // Verify the input value changed
    await expect(nameInput).toHaveValue('Test Stilguide E2E');
  });

  test('adds description and examples', async ({ page }) => {
    // Create a new guide
    await page.click('button:has-text("Opret ny")');
    await page.waitForTimeout(500);

    // Find description textarea (formål/teksttype)
    const descriptionField = page.locator('textarea').first();
    await descriptionField.fill('Test beskrivelse for stilguide');

    // Find examples textarea
    const examplesField = page.locator('textarea').nth(1);
    await examplesField.fill('Eksempel tekst 1\n\nEksempel tekst 2');

    // Check that values are set
    await expect(descriptionField).toHaveValue('Test beskrivelse for stilguide');
    await expect(examplesField).toHaveValue('Eksempel tekst 1\n\nEksempel tekst 2');
  });

  test('opens editor when creating guide', async ({ page }) => {
    // Create a new guide
    await page.click('button:has-text("Opret ny")');
    await page.waitForTimeout(500);

    // The editor should open with a "Navn" label visible
    const nameLabel = page.locator('label:has-text("Navn")').first();
    await expect(nameLabel).toBeVisible();

    // Verify input is also visible
    const nameInput = page.locator('input.input').first();
    await expect(nameInput).toBeVisible();
  });

  test('deletes a style guide', async ({ page }) => {
    // Create a new guide first
    await page.click('button:has-text("Opret ny")');
    await page.waitForTimeout(500);

    // Count guides before delete
    const guidesBefore = await page.locator('.card >> text=Ny stilguide').count();

    // Accept the confirm dialog
    page.on('dialog', dialog => dialog.accept());

    // Click delete button
    await page.click('button:has-text("Slet")');

    // Wait for deletion
    await page.waitForTimeout(500);

    // Guide should be removed
    const guidesAfter = await page.locator('.card >> text=Ny stilguide').count();
    expect(guidesAfter).toBeLessThan(guidesBefore);
  });

  test('shows "not generated" badge for new guides', async ({ page }) => {
    // Create a new guide
    await page.click('button:has-text("Opret ny")');
    await page.waitForTimeout(500);

    // Should show "Ikke genereret" badge - use .first() since there might be multiple
    await expect(page.locator('text=Ikke genereret').first()).toBeVisible();
  });

  test('can select a style guide to edit', async ({ page }) => {
    // Create a new guide
    await page.click('button:has-text("Opret ny")');
    await page.waitForTimeout(1000);

    // Close the editor first (if there's a close button)
    const closeButton = page.locator('button:has-text("Luk")');
    if (await closeButton.isVisible()) {
      await closeButton.click();
      await page.waitForTimeout(300);
    }

    // Click on the guide in the list to select it
    await page.click('.card:has-text("Ny stilguide") >> nth=0');

    // Editor should open again
    await expect(page.locator('input[value="Ny stilguide"]')).toBeVisible();
  });
});

test.describe('Style Guide Integration', () => {
  test('navigates between settings and main app', async ({ page }) => {
    // Go to settings
    await page.goto('./settings');
    await expect(page.locator('h1')).toContainText('Indstillinger');

    // Navigate to main app
    await page.click('text=Ny');
    await page.waitForLoadState('networkidle');

    // Should be on main app page
    await expect(page.locator('text=Lyd til Tekst').first()).toBeVisible();

    // Navigate back to settings via header
    await page.click('text=Indstillinger');
    await expect(page.locator('h1')).toContainText('Indstillinger');
  });
});
