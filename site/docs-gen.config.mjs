// Generated blocks in the markdown this site mounts (the starter's example docs). `project-site docs:gen` fills
// them, `project-site docs:check` fails when one is stale. Paths here are relative to this file.
import path from 'node:path';
import starter from '../starters/default/docs-gen.config.mjs';

export default {
  files: ['../starters/default/example/docs'],
  generators: {
    // The starter's generators resolve `from=` against the starter's root, so run them from there.
    exports: (ctx) => starter.generators.exports({ ...ctx, root: path.resolve(ctx.root, '../starters/default') }),
  },
};
