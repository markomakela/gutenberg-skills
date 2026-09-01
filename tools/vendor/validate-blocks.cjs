#!/usr/bin/env node
/**
 * Validates Gutenberg block markup using the same parser as WordPress core.
 *
 * Usage:
 *   echo '<!-- wp:paragraph --><p class="wp-block-paragraph">Hi</p><!-- /wp:paragraph -->' | node validate-blocks.js
 *   node validate-blocks.js < content.html
 *   node validate-blocks.js --file content.html
 *   node validate-blocks.js --skill   # extracts and validates all code blocks from SKILL.md
 */

const { parse } = require('@wordpress/block-serialization-default-parser');
const fs = require('fs');
const path = require('path');

// --- Block.json schema loading (for attribute type checks) ---

// VENDOR PATCH (WebAula). Upstream reads GUTENBERG_DIR and loads the schemas
// at require time, so two machines could silently run different checks with
// nothing in the output saying so. The load is now lazy and memoized: the
// first validateMarkup call triggers it, and later calls (from any caller)
// return the same boolean, which reports whether the per-attribute type
// checks are active. See tools/UPSTREAM.md.
let blockSchemas = null;

function loadBlockSchemas() {
  if (blockSchemas !== null) return Object.keys(blockSchemas).length > 0;
  blockSchemas = {};
  const gutenbergDir = process.env.GUTENBERG_DIR || '/tmp/gutenberg';
  const blockLibSrc = path.join(gutenbergDir, 'packages/block-library/src');
  if (!fs.existsSync(blockLibSrc)) return false;
  const dirs = fs.readdirSync(blockLibSrc, { withFileTypes: true });
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const bjPath = path.join(blockLibSrc, d.name, 'block.json');
    if (!fs.existsSync(bjPath)) continue;
    try {
      const bj = JSON.parse(fs.readFileSync(bjPath, 'utf8'));
      if (bj.name) blockSchemas[bj.name] = bj;
    } catch (e) { /* skip invalid */ }
  }
  return Object.keys(blockSchemas).length > 0;
}

// --- Validation logic ---

function validateParsedBlock(block, errors, blockIndex, depth = 0) {
  // Skip freeform (non-block) content
  if (!block.blockName) return;

  const prefix = `Block #${blockIndex} (${block.blockName})`;

  // 1. Validate JSON attributes parse correctly
  if (block.attrs && typeof block.attrs === 'string') {
    try {
      JSON.parse(block.attrs);
    } catch (e) {
      errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: Invalid JSON attributes` });
    }
  }

  const attrs = block.attrs || {};
  const fullName = block.blockName.includes('/') ? block.blockName : `core/${block.blockName}`;
  const schema = blockSchemas[fullName];

  // 1b. Check for style.typography.color (does not exist in Gutenberg)
  if (attrs.style?.typography?.color) {
    errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: "style.typography.color" does not exist in Gutenberg — use "style.color.text" instead` });
  }

  // 1b-7.0. Check WordPress 7.0 viewport visibility metadata shape.
  const blockVisibility = attrs.metadata?.blockVisibility;
  if (blockVisibility !== undefined && blockVisibility !== false && typeof blockVisibility !== 'object') {
    errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: "metadata.blockVisibility" must be false or an object with viewport rules` });
  }
  if (blockVisibility && typeof blockVisibility === 'object' && blockVisibility.viewport !== undefined) {
    if (!blockVisibility.viewport || typeof blockVisibility.viewport !== 'object' || Array.isArray(blockVisibility.viewport)) {
      errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: "metadata.blockVisibility.viewport" must be an object` });
    } else {
      const allowedViewportKeys = new Set(['mobile', 'tablet', 'desktop']);
      for (const [viewport, value] of Object.entries(blockVisibility.viewport)) {
        if (!allowedViewportKeys.has(viewport)) {
          errors.push({ block: block.blockName, level: 'warn', msg: `${prefix}: Unknown block visibility viewport "${viewport}" — WordPress 7.0 supports mobile, tablet, desktop` });
        }
        if (typeof value !== 'boolean') {
          errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: block visibility viewport "${viewport}" must be boolean` });
        }
      }
    }
  }

  // 1c. Check for top-level "align":"center" on paragraph/heading (should be style.typography.textAlign)
  const slug = block.blockName.replace('core/', '');
  if ((slug === 'paragraph' || slug === 'heading') && attrs.align && ['left', 'center', 'right'].includes(attrs.align)) {
    errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: Top-level "align":"${attrs.align}" is deprecated for text alignment — use "style.typography.textAlign" instead` });
  }

  // 1d. Check for top-level "textAlign" on heading (should be style.typography.textAlign)
  if (slug === 'heading' && attrs.textAlign) {
    errors.push({ block: block.blockName, level: 'warn', msg: `${prefix}: Top-level "textAlign" is deprecated — use "style.typography.textAlign" instead` });
  }

  // 2. Validate attribute types against block.json schema
  if (schema && schema.attributes) {
    for (const [key, value] of Object.entries(attrs)) {
      const attrDef = schema.attributes[key];
      if (!attrDef) continue; // Could be from supports, skip

      if (attrDef.type === 'number' && typeof value === 'string') {
        errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: "${key}" should be number, got string "${value}"` });
      }
      if (attrDef.type === 'boolean' && typeof value !== 'boolean') {
        errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: "${key}" should be boolean, got ${typeof value}` });
      }
      if (attrDef.type === 'integer' && (!Number.isInteger(value))) {
        errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: "${key}" should be integer, got ${typeof value} (${value})` });
      }
      if (attrDef.enum && !attrDef.enum.includes(value)) {
        errors.push({ block: block.blockName, level: 'warn', msg: `${prefix}: "${key}" value "${value}" not in enum [${attrDef.enum.join(', ')}]` });
      }
    }
  }

  // 3. Check parent/child constraints
  if (schema && schema.parent) {
    // We can't fully check nesting from flat parse, but flag it as info
  }

  // 4. Check self-closing vs paired
  const innerHTML = (block.innerHTML || '').trim();
  const innerBlocks = block.innerBlocks || [];
  const isSelfClosing = innerHTML === '' && innerBlocks.length === 0;

  // Known blocks that MUST be self-closing (server-rendered, no save output)
  const mustBeSelfClosing = new Set([
    'core/breadcrumbs',
    'core/icon',
    'core/navigation-overlay-close',
    'core/home-link',
    'core/post-title', 'core/post-featured-image', 'core/post-excerpt',
    'core/post-date', 'core/post-terms', 'core/post-content',
    'core/post-author', 'core/post-author-biography', 'core/post-author-name',
    'core/post-comment', 'core/post-comments-count', 'core/post-comments-link',
    'core/post-navigation-link', 'core/post-time-to-read',
    'core/post-comments-form', 'core/query-title',
    'core/query-total',
    'core/query-pagination-previous', 'core/query-pagination-numbers',
    'core/query-pagination-next', 'core/comments-title', 'core/avatar',
    'core/comment-author-avatar',
    'core/comment-author-name', 'core/comment-date', 'core/comment-content',
    'core/comment-reply-link', 'core/comment-edit-link',
    'core/site-title', 'core/site-tagline', 'core/site-logo',
    'core/search', 'core/loginout', 'core/page-list',
    'core/page-list-item',
    'core/latest-posts', 'core/latest-comments', 'core/categories',
    'core/archives', 'core/tag-cloud', 'core/rss', 'core/calendar',
    'core/navigation-link', 'core/social-link', 'core/pattern',
    'core/template-part',
    'core/comments-pagination-previous', 'core/comments-pagination-numbers',
    'core/comments-pagination-next',
    'core/block', 'core/footnotes', 'core/math', 'core/read-more',
    'core/table-of-contents', 'core/term-count', 'core/term-description',
    'core/term-name',
  ]);

  if (mustBeSelfClosing.has(fullName) && !isSelfClosing) {
    errors.push({ block: block.blockName, level: 'warn', msg: `${prefix}: Server-rendered block should be self-closing but has inner content` });
  }

  // 5. Check for common HTML issues in the block's OWN HTML (not inner blocks)
  // innerContent has null entries where inner blocks go; non-null parts are this block's HTML
  const ownHtml = (block.innerContent || []).filter(c => c !== null).join('').trim();

  if (ownHtml) {
    // Missing wp-block- class on known blocks
    const expectedClass = `wp-block-${block.blockName.replace('core/', '').replace('/', '-')}`;
    // Blocks where the wp-block-{name} class is added by useBlockProps.save() and IS required.
    // Blocks with `supports.className: false` do NOT get the auto-generated class.
    const classRequired = [
      'image', 'group', 'columns', 'column', 'cover', 'buttons', 'button',
      'list', 'quote', 'pullquote', 'separator', 'media-text', 'table',
      'code', 'preformatted', 'embed', 'gallery', 'spacer', 'details',
      'audio', 'video', 'file', 'verse', 'social-links', 'heading',
      'accordion', 'accordion-item', 'accordion-heading', 'accordion-panel',
      'tabs', 'tabs-menu', 'tabs-menu-item', 'tab', 'tab-panel',
      'form', 'form-input', 'form-submit-button', 'form-submission-notification',
      'text-columns', 'terms-query', 'navigation-overlay-close',
    ];
    // Blocks with supports.className: false — do NOT get wp-block-{name} class
    const classExcluded = ['paragraph', 'list-item', 'html', 'shortcode', 'more', 'nextpage', 'freeform', 'missing'];

    if (classRequired.includes(slug) && !ownHtml.includes(expectedClass)) {
      errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: Missing expected class "${expectedClass}" in HTML` });
    } else if (classExcluded.includes(slug) && ownHtml.includes(expectedClass)) {
      errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: Has class "${expectedClass}" but this block has supports.className:false — class must NOT be present` });
    }

    // Image-specific: check wp-image-{id}
    if (slug === 'image' && attrs.id && !ownHtml.includes(`wp-image-${attrs.id}`)) {
      errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: Missing "wp-image-${attrs.id}" class on <img>` });
    }

    // Image: check src matches url
    if (slug === 'image' && attrs.url) {
      const srcMatch = ownHtml.match(/src="([^"]+)"/);
      if (srcMatch && srcMatch[1] !== attrs.url) {
        errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: <img src="${srcMatch[1]}"> doesn't match url attr "${attrs.url}"` });
      }
    }

    // Heading: check tag matches level
    if (slug === 'heading') {
      const level = attrs.level || 2;
      const tagMatch = ownHtml.match(/<h([1-6])/);
      if (tagMatch && parseInt(tagMatch[1]) !== level) {
        errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: <h${tagMatch[1]}> doesn't match level ${level}` });
      }
    }

    // List: check ol vs ul matches ordered
    if (slug === 'list') {
      const isOrdered = attrs.ordered === true;
      if (isOrdered && ownHtml.includes('<ul')) {
        errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: ordered=true but uses <ul>` });
      }
      if (!isOrdered && ownHtml.includes('<ol')) {
        errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: ordered is not true but uses <ol>` });
      }
    }

    // Button: check wp-element-button class
    if (slug === 'button' && !ownHtml.includes('wp-element-button')) {
      errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: Missing "wp-element-button" class on button inner element` });
    }

    // Button: check has-custom-font-size when fontSize is set
    if (slug === 'button' && (attrs.fontSize || attrs.style?.typography?.fontSize) && !ownHtml.includes('has-custom-font-size')) {
      errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: Missing "has-custom-font-size" class — required when fontSize or style.typography.fontSize is set` });
    }

    // Button: check has-border-color when border color is set
    if (slug === 'button' && (attrs.borderColor || attrs.style?.border?.color) && !ownHtml.includes('has-border-color')) {
      errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: Missing "has-border-color" class — required when borderColor or style.border.color is set` });
    }

    // File: check aria-describedby on download button
    if (slug === 'file' && attrs.id && ownHtml.includes('wp-block-file__button') && !ownHtml.includes('aria-describedby')) {
      errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: Missing "aria-describedby" on download button <a> — required: aria-describedby="wp-block-file--media-{id}"` });
    }

    // Separator: check has-alpha-channel-opacity
    if (slug === 'separator' && !ownHtml.includes('has-alpha-channel-opacity')) {
      errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: Missing "has-alpha-channel-opacity" class` });
    }

    // WordPress 7.0 block-level custom CSS requires a marker class in saved HTML.
    if (attrs.style?.css && !ownHtml.includes('has-custom-css')) {
      errors.push({ block: block.blockName, level: 'error', msg: `${prefix}: Missing "has-custom-css" class — required when style.css is set` });
    }
  }

  // Recurse into inner blocks
  for (const inner of innerBlocks) {
    validateParsedBlock(inner, errors, blockIndex, depth + 1);
  }
}

function validateMarkup(markup, label) {
  loadBlockSchemas();
  const parsed = parse(markup);
  const errors = [];
  let blockCount = 0;

  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].blockName) {
      blockCount++;
      validateParsedBlock(parsed[i], errors, blockCount);
    }
  }

  // Check for parse-level issues: if the parser couldn't find any blocks
  if (blockCount === 0 && markup.includes('<!-- wp:')) {
    errors.push({ block: '(parser)', level: 'error', msg: 'Markup contains block comments but parser found 0 blocks — likely malformed delimiters' });
  }

  return { parsed, blockCount, errors, label };
}

// --- Extract code blocks from SKILL.md ---

function extractCodeBlocks(markdown) {
  const codeBlockPattern = /```html\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  let index = 0;
  while ((match = codeBlockPattern.exec(markdown)) !== null) {
    index++;
    const before = markdown.substring(0, match.index);
    const lineNum = before.split('\n').length;
    blocks.push({ code: match[1], index, lineNum });
  }
  return blocks;
}

// --- Main ---

// VENDOR PATCH (WebAula). Upstream is a CLI script: requiring it would run the
// argument dispatch below and block on stdin. The export lets
// tools/validate-blocks.mjs call the upstream checks directly instead of
// shelling out per file, and the guard keeps the CLI behaviour identical when
// the file is executed. The only other modification is the lazy schema load
// above. See tools/UPSTREAM.md.
module.exports = { validateMarkup, loadBlockSchemas };

const args = require.main === module ? process.argv.slice(2) : [];

if (require.main !== module) {
  // Required as a library. Skip the CLI dispatch.
} else if (args.includes('--skill')) {
  const hasSchemas = loadBlockSchemas();
  // Validate all code blocks in SKILL.md
  const pathIdx = args.indexOf('--path');
  const skillPath = pathIdx !== -1 && args[pathIdx + 1]
    ? args[pathIdx + 1]
    : path.join(__dirname, 'gutenberg-content', 'SKILL.md');
  const markdown = fs.readFileSync(skillPath, 'utf8');
  const codeBlocks = extractCodeBlocks(markdown);

  console.log(`=== Block Markup Validation (SKILL.md) ===\n`);
  console.log(`Code blocks found: ${codeBlocks.length}`);
  if (hasSchemas) {
    console.log(`Block schemas loaded: ${Object.keys(blockSchemas).length}`);
  } else {
    console.log(`Block schemas: not available (clone Gutenberg to /tmp/gutenberg for type checking)`);
  }
  console.log('');

  let totalBlocks = 0;
  let totalErrors = 0;
  let totalWarnings = 0;
  const failedBlocks = [];

  for (const { code, index, lineNum } of codeBlocks) {
    // Skip code blocks that are just JSON or grammar examples
    if (!code.includes('<!-- wp:')) continue;

    const result = validateMarkup(code, `Code block #${index} (line ${lineNum})`);
    totalBlocks += result.blockCount;

    const errs = result.errors.filter(e => e.level === 'error');
    const warns = result.errors.filter(e => e.level === 'warn');
    totalErrors += errs.length;
    totalWarnings += warns.length;

    if (errs.length > 0) {
      failedBlocks.push({ index, lineNum, errors: errs, warnings: warns });
    }
  }

  if (failedBlocks.length === 0) {
    console.log(`PASSED: All code blocks valid (${totalBlocks} blocks parsed)`);
  } else {
    console.log(`FAILED: ${failedBlocks.length} code block(s) with errors\n`);
    for (const fb of failedBlocks) {
      console.log(`--- Code block #${fb.index} (SKILL.md line ${fb.lineNum}) ---`);
      for (const e of fb.errors) {
        console.log(`  ✗ ${e.msg}`);
      }
      for (const w of fb.warnings) {
        console.log(`  ⚠ ${w.msg}`);
      }
      console.log('');
    }
  }

  if (totalWarnings > 0 && failedBlocks.length === 0) {
    console.log(`\nWarnings: ${totalWarnings}`);
    for (const { code, index, lineNum } of codeBlocks) {
      if (!code.includes('<!-- wp:')) continue;
      const result = validateMarkup(code);
      const warns = result.errors.filter(e => e.level === 'warn');
      for (const w of warns) {
        console.log(`  ⚠ Code block #${index} (line ${lineNum}): ${w.msg}`);
      }
    }
  }

  console.log(`\nSummary: ${totalBlocks} blocks, ${totalErrors} errors, ${totalWarnings} warnings`);
  process.exit(totalErrors > 0 ? 1 : 0);

} else if (args.includes('--file')) {
  const fileIdx = args.indexOf('--file') + 1;
  const filePath = args[fileIdx];
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  const markup = fs.readFileSync(filePath, 'utf8');
  const result = validateMarkup(markup, filePath);
  printResult(result);
  process.exit(result.errors.filter(e => e.level === 'error').length > 0 ? 1 : 0);

} else {
  // Read from stdin
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    if (!input.trim()) {
      console.log('Usage:');
      console.log('  node validate-blocks.js --skill              # validate all SKILL.md examples');
      console.log('  node validate-blocks.js --file content.html  # validate a file');
      console.log('  echo "markup" | node validate-blocks.js      # validate from stdin');
      process.exit(0);
    }
    const result = validateMarkup(input, 'stdin');
    printResult(result);
    process.exit(result.errors.filter(e => e.level === 'error').length > 0 ? 1 : 0);
  });
}

function printResult(result) {
  console.log(`=== Block Markup Validation ===\n`);
  console.log(`Source: ${result.label}`);
  console.log(`Blocks parsed: ${result.blockCount}`);

  if (result.errors.length === 0) {
    console.log('\nPASSED: All blocks valid');
  } else {
    const errs = result.errors.filter(e => e.level === 'error');
    const warns = result.errors.filter(e => e.level === 'warn');
    if (errs.length > 0) {
      console.log(`\nErrors (${errs.length}):`);
      errs.forEach(e => console.log(`  ✗ ${e.msg}`));
    }
    if (warns.length > 0) {
      console.log(`\nWarnings (${warns.length}):`);
      warns.forEach(e => console.log(`  ⚠ ${e.msg}`));
    }
  }
}
