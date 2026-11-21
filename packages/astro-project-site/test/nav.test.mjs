import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeHref, isActive } from '../src/lib/nav.ts';

const nav = ['/docs/', '/docs/guide/', '/blog/', '/gallery/', 'https://github.com/x/y'];

test('activeHref: the most specific nav link that contains the page', () => {
  assert.equal(activeHref(nav, '/docs/guide/'), '/docs/guide/');
  assert.equal(activeHref(nav, '/docs/guide/sprite/'), '/docs/guide/');
  assert.equal(activeHref(nav, '/docs/reference/cli/'), '/docs/');
  assert.equal(activeHref(nav, '/docs'), '/docs/');
  assert.equal(activeHref(nav, '/blog/hello/index.html'), '/blog/');
  assert.equal(activeHref(nav, '/'), undefined);
  assert.equal(activeHref(['/', '/docs/'], '/'), '/');
  assert.equal(activeHref(['/', '/docs/'], '/docs/x/'), '/docs/');
  // A prefix of the name is not a parent: /docs-old/ is not under /docs/.
  assert.equal(activeHref(nav, '/docs-old/'), undefined);
});

test('isActive keeps matching every section that contains the page', () => {
  assert.ok(isActive('/docs/', '/docs/guide/'));
  assert.ok(isActive('/docs/guide/', '/docs/guide/'));
  assert.ok(!isActive('https://github.com/x/y', '/'));
});
