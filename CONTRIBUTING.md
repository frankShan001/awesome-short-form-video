# Contribution guidelines

Suggestions are welcome. Open a pull request that adds, fixes or removes one entry, or an issue if you are not sure where something belongs.

## What belongs here

Tools and references for making vertical short video for TikTok, YouTube Shorts, Instagram Reels and Facebook Reels with code, command-line tools or agents.

- Open source tools and models. Source-available tools are fine when the entry names the limit (for example "custom license" or "non-commercial weights").
- First-party documentation from the apps themselves: specs, help pages and developer APIs.
- Agent skills and MCP servers that work today, with install steps in their README.

## What does not belong

- Closed, paid avatar or presenter tools.
- Hosted services with no open code you can run yourself.
- Tools whose main use is copying other people's videos, buying views or faking engagement.
- Spec compilations that do not cite the app's own page for each figure.

## Inclusion rules

1. A GitHub repository must exist, must not be archived and must have had a push within the last 12 months. `node scripts/check-repos.mjs` checks this for every GitHub link in the README, and a scheduled job runs it every month.
2. The README must say what the project does and how to install or run it, with no deprecation or "no longer maintained" notice.
3. Documentation links must be first-party, must load without a sign-in and must not carry tracking parameters.
4. Link a project to its GitHub repository when it has one, so the monthly check can see it.
5. If you work on or are paid by a project you add, say so in the pull request. Entries by this list's maintainers end with "(by the maintainers)".

Entries that turn archived, stale or broken are removed in the next monthly review.

## Format

- One entry per line: `- [Name](https://link) - Description.`
- The description says what the tool does, in under 20 words, starts with a capital letter and ends with a period.
- Plain, factual words: no marketing terms, no emoji, no prices and no star counts.
- Use commas, colons or "to" instead of en or em dashes.
- Keep each section in alphabetical order by name, ignoring letter case.
- Use each project's own spelling of its name, such as FFmpeg, Node.js and YouTube.

## Before you open a pull request

```sh
node test.mjs
GITHUB_TOKEN=your_token node scripts/check-repos.mjs
```

`test.mjs` checks the entry format, the order, the Contents section and the link parser. The token is optional; without it the GitHub API allows fewer requests per hour. Pull requests also run a link checker.

By contributing you agree to release your contribution under the [CC0 1.0](LICENSE) dedication.
