import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assess, isStale, parseGitHubRepos, parseRepoUrl } from './scripts/check-repos.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    console.error(`not ok: ${name}`);
    throw error;
  }
}

test('parseRepoUrl reads owner and repo and rejects non-repository links', () => {
  assert.deepEqual(parseRepoUrl('https://github.com/acme/tool/tree/main/skills'), { owner: 'acme', repo: 'tool', slug: 'acme/tool' });
  assert.equal(parseRepoUrl('https://github.com/acme/tool.git').slug, 'acme/tool');
  assert.equal(parseRepoUrl('https://github.com/sponsors/acme'), null);
  assert.equal(parseRepoUrl('https://github.com/acme'), null);
  assert.equal(parseRepoUrl('https://gist.github.com/acme/abc'), null);
  assert.equal(parseRepoUrl('not a url'), null);
});

test('parseGitHubRepos finds each repository once from the fixture', () => {
  const slugs = parseGitHubRepos(read('./scripts/fixtures/links.md')).map((r) => r.slug);
  assert.deepEqual(slugs, ['acme/render-kit', 'acme/caption-tool', 'acme/voice', 'acme/dot.name_repo']);
});

test('isStale uses a 365 day window', () => {
  const { now, repos } = JSON.parse(read('./scripts/fixtures/api.json'));
  const at = new Date(now);
  assert.equal(isStale(repos['acme/fresh'].pushed_at, at), false);
  assert.equal(isStale(repos['acme/edge'].pushed_at, at), false);
  assert.equal(isStale(repos['acme/old'].pushed_at, at), true);
  assert.equal(isStale('not a date', at), true);
  assert.equal(isStale('2026-06-01T00:00:00Z', at, 90), true);
});

test('assess reports archived, disabled, stale, missing and moved repositories', () => {
  const { now, repos } = JSON.parse(read('./scripts/fixtures/api.json'));
  const at = new Date(now);
  const status = (slug) => assess(slug, repos[slug] ?? null, at).status;
  assert.equal(status('acme/fresh'), 'ok');
  assert.equal(status('acme/edge'), 'ok');
  assert.equal(status('acme/old'), 'stale');
  assert.equal(status('acme/archived'), 'archived');
  assert.equal(status('acme/disabled'), 'disabled');
  assert.equal(status('acme/no-date'), 'stale');
  assert.equal(status('acme/gone'), 'missing');
  const moved = assess('acme/renamed', repos['acme/renamed'], at);
  assert.equal(moved.status, 'ok');
  assert.equal(moved.movedTo, 'acme-org/renamed-tool');
});

const readme = read('./README.md');
const contributing = read('./CONTRIBUTING.md');
const sections = readme.split(/^## /m).slice(1).map((block) => {
  const [title, ...rest] = block.split('\n');
  return { title: title.trim(), body: rest.join('\n') };
});
const listSections = sections.filter((s) => !['Contents', 'Contributing', 'Footnotes'].includes(s.title));
const ENTRY = /^- \[([^\]]+)\]\((https?:\/\/[^)\s]+)\) - (.+)$/;
const MARK = ' (by the maintainers)';

test('Contents lists every list section in order', () => {
  const contents = sections.find((s) => s.title === 'Contents').body;
  const listed = [...contents.matchAll(/^- \[([^\]]+)\]\(#([^)]+)\)$/gm)];
  assert.deepEqual(listed.map((m) => m[1]), listSections.map((s) => s.title));
  for (const [, title, anchor] of listed) {
    assert.equal(anchor, title.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-'));
  }
});

test('every entry follows "- [Name](url) - Description." in alphabetical order', () => {
  const urls = new Set();
  for (const section of listSections) {
    const items = section.body.split('\n').filter((line) => line.startsWith('- '));
    assert.ok(items.length > 0, `${section.title} has no entries`);
    const names = [];
    for (const line of items) {
      const match = line.match(ENTRY);
      assert.ok(match, `bad entry format: ${line}`);
      const [, name, url, description] = match;
      assert.match(description, /^[A-Z0-9]/, `description should start with a capital: ${name}`);
      assert.ok(description.endsWith('.'), `description should end with a period: ${name}`);
      const words = description.replace(MARK, '').split(/\s+/).length;
      assert.ok(words < 20, `${name} description has ${words} words`);
      assert.ok(!/[?&]utm_/i.test(url), `tracking parameter in ${url}`);
      assert.ok(!urls.has(url), `duplicate link ${url}`);
      urls.add(url);
      names.push(name.toLowerCase());
    }
    assert.deepEqual(names, [...names].sort(), `${section.title} is not alphabetical`);
  }
});

test('entries by the maintainers are marked', () => {
  for (const line of readme.split('\n').filter((l) => /github\.com\/viewgum\//.test(l))) {
    assert.ok(line.endsWith(`${MARK}.`), `unmarked maintainer entry: ${line}`);
  }
});

const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

test('text has no en or em dashes, emoji or hype words', () => {
  const hype = /\b(revolutionary|powerful|seamless(ly)?|effortless(ly)?|ultimate|blazing|best-in-class|game-?changing|insane(ly)?|cutting-edge|world-class|magic(al)?|supercharge|unleash|state-of-the-art)\b/i;
  for (const [name, text] of [['README.md', readme], ['CONTRIBUTING.md', contributing]]) {
    assert.ok(!DASHES.test(text), `${name} has an en or em dash`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(text), `${name} has an emoji`);
    const word = text.match(hype);
    assert.ok(!word, `${name} uses "${word?.[0]}"`);
  }
});

console.log(`${passed} tests passed`);
