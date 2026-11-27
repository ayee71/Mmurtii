import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_READING_MODE_PREFS,
  clampFontScale,
  sanitizeReadingModePrefs,
  getReadingWidthClass,
  getReadingThemeContainerClass,
} from '../src/context/ReadingModeContext';

const root = path.resolve(process.cwd());

console.log('Running Reading Mode unit & integration checks...');

// 1. Clamp & Sanitize Preferences
assert.equal(clampFontScale(0.5), 0.9, 'Font scale clamps minimum to 0.9');
assert.equal(clampFontScale(2.0), 1.35, 'Font scale clamps maximum to 1.35');
assert.equal(clampFontScale('not-a-number'), DEFAULT_READING_MODE_PREFS.fontScale, 'Invalid font scale falls back to default');
assert.deepEqual(sanitizeReadingModePrefs(null), DEFAULT_READING_MODE_PREFS, 'Null prefs returns defaults');

const sanitized = sanitizeReadingModePrefs({
  isReadingMode: true,
  readingTheme: 'sepia',
  readingWidth: 'narrow',
  fontScale: 1.2,
  isBarCollapsed: true,
});
assert.deepEqual(sanitized, {
  isReadingMode: true,
  readingTheme: 'sepia',
  readingWidth: 'narrow',
  fontScale: 1.2,
  isBarCollapsed: true,
});

const sanitizedInvalid = sanitizeReadingModePrefs({
  isReadingMode: 1,
  readingTheme: 'neon_pink',
  readingWidth: 'tiny',
  fontScale: 99,
});
assert.equal(sanitizedInvalid.readingTheme, 'default', 'Unknown theme falls back to default');
assert.equal(sanitizedInvalid.readingWidth, 'standard', 'Unknown width falls back to standard');
assert.equal(sanitizedInvalid.fontScale, 1.35, 'Excessive fontScale clamps safely');

// 2. Width & Surface Helpers
assert.equal(getReadingWidthClass('narrow'), 'max-w-3xl');
assert.equal(getReadingWidthClass('standard'), 'max-w-5xl');
assert.equal(getReadingWidthClass('wide'), 'max-w-7xl');
assert.ok(getReadingThemeContainerClass('paper').includes('reading-surface-paper'));
assert.ok(getReadingThemeContainerClass('sepia').includes('reading-surface-sepia'));
assert.ok(getReadingThemeContainerClass('night').includes('reading-surface-night'));

// 3. App.tsx Chrome Hiding & Provider Wiring
const appSrc = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const mainSrc = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
assert.ok(mainSrc.includes('ReadingModeProvider'), 'main.tsx must wrap App in ReadingModeProvider');
assert.ok(appSrc.includes('!isReadingMode'), 'App.tsx must hide chrome elements when isReadingMode is true');
assert.ok(appSrc.includes('!hideHeader && !isReadingMode && activeTab !== \'caseStatus\''), 'Navbar and BottomNavbar must hide in Reading Mode');
assert.ok(appSrc.includes('<ReadingModeBar currentLang={currentLang} />'), 'App.tsx must render ReadingModeBar when active');
assert.ok(appSrc.includes('onToggleReadingMode: toggleReadingMode'), 'App.tsx must wire Reading Mode shortcut');
assert.ok(appSrc.includes('exitReadingMode()'), 'App.tsx must allow Escape key to exit Reading Mode');

// 4. Navbar, BottomNavbar, Shortcuts & Command Palette Triggers
const navbarSrc = fs.readFileSync(path.join(root, 'src/components/Navbar.tsx'), 'utf8');
const bottomNavSrc = fs.readFileSync(path.join(root, 'src/components/BottomNavbar.tsx'), 'utf8');
const shortcutsSrc = fs.readFileSync(path.join(root, 'src/hooks/useGlobalShortcuts.ts'), 'utf8');
const paletteSrc = fs.readFileSync(path.join(root, 'src/components/GlobalCommandPalette.tsx'), 'utf8');
const progressSrc = fs.readFileSync(path.join(root, 'src/components/ReadingProgressBar.tsx'), 'utf8');

assert.ok(navbarSrc.includes('onClick={toggleReadingMode}'), 'Navbar must include Reading Mode toggle button');
assert.ok(bottomNavSrc.includes('toggleReadingMode()'), 'BottomNavbar drawer must include Reading Mode toggle');
assert.ok(shortcutsSrc.includes("e.key.toLowerCase() === 'r'"), 'useGlobalShortcuts must bind Alt+R');
assert.ok(paletteSrc.includes('action-reading-mode'), 'GlobalCommandPalette must list Reading Mode action');
assert.ok(progressSrc.includes("isReadingMode ? 'top-0' : 'top-16'"), 'ReadingProgressBar must dock at top-0 when Navbar is hidden');

// 5. View-Level Sidebars Collapse & Expand Content Width
const viewFiles = [
  'src/components/CassationMasterPortal.tsx',
  'src/views/ExplainLawView.tsx',
  'src/views/DocumentAnalysisView.tsx',
  'src/views/CreateView.tsx',
  'src/views/CourtAIDashboardView.tsx',
];
for (const relPath of viewFiles) {
  const content = fs.readFileSync(path.join(root, relPath), 'utf8');
  assert.ok(content.includes('useReadingMode'), `${relPath} must consume useReadingMode`);
  assert.ok(content.includes('isReadingMode'), `${relPath} must conditionally hide sidebars in Reading Mode`);
}

// 6. CSS Surface & Typography Overrides
const cssSrc = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
assert.ok(cssSrc.includes('html[data-reading-mode="true"]'), 'index.css must style active Reading Mode typography');
assert.ok(cssSrc.includes('[data-reading-theme="sepia"]'), 'index.css must include sepia surface overrides');
assert.ok(cssSrc.includes('[data-reading-theme="paper"]'), 'index.css must include paper surface overrides');

console.log('✅ All Reading Mode tests passed!');
