# Security policy

## Supported versions

astro-project-site is in beta. Security fixes go into the latest release only.

| Version | Supported |
|---|---|
| 0.1.x (beta, npm tag `beta`) | yes, latest release only |
| anything older | no |

Fixes ship as a new release; upgrade with `npm install astro-project-site@beta` and move your
`deploy.yml@v<version>` pin to the same tag.

## Reporting a vulnerability

Please do **not** open a public issue, discussion or pull request for a security problem.

Report it privately through GitHub: on the repository, open **Security → Report a vulnerability**
([direct link](https://github.com/pavelpascari/astro-project-site/security/advisories/new)). This opens a private
advisory that only you and the maintainer can see.

Useful to include:

- the affected version (`npm ls astro-project-site`) and, for the workflow, the `deploy.yml@…` ref you call;
- what an attacker controls and what they gain;
- a minimal reproduction: a repository, a config, or the steps.

## What to expect

astro-project-site is maintained by one person in their spare time, so these are targets, not guarantees:

- an acknowledgement within 7 days;
- a first assessment (accepted, needs more information, or out of scope) within 14 days;
- for accepted reports, a fix or a mitigation as soon as practical, usually within 90 days, released together with
  a GitHub security advisory. You are credited in the advisory unless you ask not to be.

Please give the fix time to ship before disclosing publicly. If a report goes unanswered for 14 days, a reminder
on the same advisory is welcome.

## Scope

In scope:

- **The npm package** `astro-project-site`: the Astro integration, its components, content helpers, markdown
  pipeline, docs mounts, mirrors and generated files (`/llms.txt` and the rest), for example HTML or script
  injection into built pages from content the site owner does not fully control.
- **The CLI**, `project-site` (`npx astro-project-site init`, `docs:gen`, `docs:check`, `deploy:preview`). `init`
  reads a repository you point it at, which may be untrusted: its `package.json`, git config, README and other
  files must never lead to code execution, files written outside the target folder, or generated config that runs
  attacker-controlled code.
- **The reusable deploy workflow**, `.github/workflows/deploy.yml`, called by projects as
  `pavelpascari/astro-project-site/.github/workflows/deploy.yml@v<version>`: for example leaking the Cloudflare or
  source-repository secrets, running untrusted pull-request code with secrets, or script injection through
  workflow inputs, branch names or PR titles.
- The starter that `init` copies (`starters/default/`).

Out of scope:

- Vulnerabilities in dependencies (Astro, Starlight, Vite, wrangler, …) with no specific impact through
  astro-project-site: report those upstream. If astro-project-site makes one reachable or worse, it is in scope.
- The template's own website (`site/`) and its deployment, except where it shows a problem in the package.
- Content a site owner writes themselves (their own markdown, MDX, scripts or `<Live>` runners run with the
  site's privileges by design).
- Issues that need a compromised machine, a compromised GitHub account or Cloudflare account, or a malicious
  dependency installed by the user.
