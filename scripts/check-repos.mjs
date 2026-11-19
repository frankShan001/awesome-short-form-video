#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const MAX_AGE_DAYS = 365;

const RESERVED_OWNERS = new Set([
  'about', 'apps', 'collections', 'customer-stories', 'enterprise', 'events', 'explore', 'features',
  'login', 'marketplace', 'notifications', 'orgs', 'pricing', 'readme', 'settings', 'site', 'sponsors',
  'topics', 'trending', 'users',
]);

const LINK = /\]\((https?:\/\/(?:www\.)?github\.com\/[^)\s]+)\)/g;

export function parseRepoUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') return null;
  const [owner, rawRepo] = parsed.pathname.split('/').filter(Boolean);
  if (!owner || !rawRepo || RESERVED_OWNERS.has(owner.toLowerCase())) return null;
  const repo = rawRepo.replace(/\.git$/, '');
  if (!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) return null;
  return { owner, repo, slug: `${owner}/${repo}` };
}

export function parseGitHubRepos(markdown) {
  const seen = new Map();
  for (const match of markdown.matchAll(LINK)) {
    const found = parseRepoUrl(match[1]);
    if (!found) continue;
    const key = found.slug.toLowerCase();
    if (!seen.has(key)) seen.set(key, { ...found, url: match[1] });
  }
  return [...seen.values()];
}

export function isStale(pushedAt, now = new Date(), maxAgeDays = MAX_AGE_DAYS) {
  const pushed = new Date(pushedAt);
  if (Number.isNaN(pushed.getTime())) return true;
  return now.getTime() - pushed.getTime() > maxAgeDays * 24 * 60 * 60 * 1000;
}

export function assess(slug, info, now = new Date(), maxAgeDays = MAX_AGE_DAYS) {
  if (!info) return { slug, status: 'missing' };
  const result = { slug, pushedAt: info.pushed_at, status: 'ok' };
  if (info.full_name && info.full_name.toLowerCase() !== slug.toLowerCase()) result.movedTo = info.full_name;
  if (info.archived) result.status = 'archived';
  else if (info.disabled) result.status = 'disabled';
  else if (isStale(info.pushed_at, now, maxAgeDays)) result.status = 'stale';
  return result;
}

async function fetchRepo(slug, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'awesome-short-form-video-check',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com/repos/${slug}`, { headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${slug}: GitHub API answered ${response.status}`);
  return response.json();
}

async function main() {
  const file = process.argv[2] ?? 'README.md';
  const markdown = await readFile(file, 'utf8');
  const repos = parseGitHubRepos(markdown);
  const token = process.env.GITHUB_TOKEN;
  const now = new Date();
  const results = [];
  const queue = [...repos];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const { slug } = queue.shift();
      results.push(assess(slug, await fetchRepo(slug, token), now));
    }
  });
  await Promise.all(workers);
  results.sort((a, b) => a.slug.localeCompare(b.slug));

  const problems = results.filter((r) => r.status !== 'ok');
  for (const r of results) {
    if (r.status !== 'ok' || r.movedTo) {
      const moved = r.movedTo ? ` (moved to ${r.movedTo})` : '';
      console.log(`${r.status.padEnd(8)} ${r.slug}${moved} pushed ${r.pushedAt ?? 'n/a'}`);
    }
  }
  console.log(`${results.length} repositories checked, ${problems.length} archived, disabled, missing or stale (no push in ${MAX_AGE_DAYS} days).`);
  if (problems.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
