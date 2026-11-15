import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { printPageStyle } from '../public/js/printLayout.js';

test('print format follows selected paper and assigns margins to the document only', () => {
  const a4 = printPageStyle('a4');
  const letter = printPageStyle('letter');
  assert.match(a4, /size: a4 portrait; margin: 0/);
  assert.match(a4, /210mm/); assert.match(a4, /297mm/);
  assert.match(letter, /size: letter portrait; margin: 0/);
  assert.match(letter, /8\.5in/); assert.match(letter, /11in/);
  assert.equal(printPageStyle('unknown'), a4);
});

test('print rules reset editor constraints without discarding preview content padding', () => {
  const css = readFileSync(new URL('../public/css/styles.css', import.meta.url), 'utf8');
  const print = css.slice(css.indexOf('@media print {'));
  assert.match(print, /#right-panel\.preview-panel\s*\{[^}]*max-width: none !important/s);
  assert.match(print, /#paper-viewport-container, #paper-wrapper, #paper-viewport, #paper-scaler\s*\{[^}]*transform: none !important/s);
  assert.match(print, /#paper-scaler \.resume-paper\s*\{[^}]*padding: var\(--page-pad-v, 34px\) var\(--page-pad-h, 44px\) !important/s);
  assert.match(print, /#paper-scaler #resume-paper-p2\s*\{ break-before: page/);
  assert.doesNotMatch(print, /overflow:\s*hidden/);
});
