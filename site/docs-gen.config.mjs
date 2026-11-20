// Generated blocks in this site's markdown. `project-site docs:gen` fills them, `project-site docs:check` (part of
// `npm run build`) fails when one is stale, so the reference pages cannot drift from the package's source.
// Paths here are relative to this file.
//
//   <!-- gen:options -->                         every projectSite() option: type, default (from the zod schema), docs
//   <!-- gen:interface name=Mirror -->            one interface from the package's types (index.d.ts or live/types.ts)
//   <!-- gen:components -->                       every component in astro-project-site/components, with its props
//   <!-- gen:schema name=gallerySchema -->        a zod object schema from src/content.ts
//   <!-- gen:tokens -->                           the --site-* design tokens from theme.css, both themes
//   <!-- gen:cli -->                              `project-site --help`
//   <!-- gen:file from=src/virtual.d.ts lang=ts --> a package file, verbatim
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import starter from '../starters/default/docs-gen.config.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const pkg = path.resolve(here, '../packages/astro-project-site');
const src = (/** @type {string} */ rel) => path.join(pkg, 'src', rel);
const read = (/** @type {string} */ file) => fs.readFileSync(file, 'utf8');

// ---------- TypeScript helpers ----------

/** @param {string} file @param {string} [text] */
function parse(file, text = read(file)) {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

const oneLine = (/** @type {string} */ s) => s.replace(/\s+/g, ' ').trim();
/** Markdown table cell: one line, pipes escaped (also inside code spans, as GFM requires). */
const cell = (/** @type {string} */ s) => escapeHtml(oneLine(s)).replace(/\|/g, '\\|');
/** A table cell that will be wrapped in a code span: no HTML escaping there. */
const raw = (/** @type {string} */ s) => oneLine(s).replace(/\|/g, '\\|');
/** `<` outside code spans would be read as HTML by the markdown renderer. */
const escapeHtml = (/** @type {string} */ s) => s.split(/(`[^`]*`)/).map((part, i) => (i % 2 ? part : part.replace(/</g, '&lt;'))).join('');
/** A default value for a table: long computed expressions are summarised (the description says how). */
const shownDefault = (/** @type {string | undefined} */ d) => (!d ? '' : d.length > 40 ? '(computed)' : code(raw(d)));
const code = (/** @type {string} */ s) => (s ? `\`${s}\`` : '');

/** The JSDoc text of a node (`/** … *\/` above it), or ''. */
function jsDoc(/** @type {ts.Node} */ node) {
  const docs = /** @type {any} */ (node).jsDoc;
  if (!docs?.length) return '';
  return docs.map((/** @type {ts.JSDoc} */ d) => ts.getTextOfJSDocComment(d.comment) ?? '').join(' ');
}

/** @returns {ts.InterfaceDeclaration | undefined} */
function findInterface(/** @type {ts.SourceFile} */ sf, /** @type {string} */ name) {
  return /** @type {any} */ (sf.statements.find((s) => ts.isInterfaceDeclaration(s) && s.name.text === name));
}

/** Members of an interface (or type literal): name, optional, type text, doc. Inline object types are expanded
 *  into `parent.child` rows; methods are shown as `name(…)` with a function type. */
function members(/** @type {ts.InterfaceDeclaration | ts.TypeLiteralNode} */ decl, prefix = '') {
  /** @type {{ name: string, optional: boolean, type: string, doc: string }[]} */
  const out = [];
  for (const m of decl.members) {
    if (ts.isPropertySignature(m)) {
      const name = prefix + m.name.getText();
      if (m.type && ts.isTypeLiteralNode(m.type)) {
        out.push({ name, optional: !!m.questionToken, type: 'object', doc: jsDoc(m) });
        out.push(...members(m.type, `${name}.`));
      } else out.push({ name, optional: !!m.questionToken, type: m.type ? typeText(m.type) : 'unknown', doc: jsDoc(m) });
    } else if (ts.isMethodSignature(m)) {
      const params = m.parameters.map((p) => oneLine(p.getText())).join(', ');
      out.push({ name: `${prefix}${m.name.getText()}()`, optional: !!m.questionToken, type: `(${params}) => ${m.type ? typeText(m.type) : 'void'}`, doc: jsDoc(m) });
    }
  }
  return out;
}

/** Type text without the JSDoc comments of nested members. */
const typeText = (/** @type {ts.TypeNode} */ t) => oneLine(t.getText().replace(/\/\*[\s\S]*?\*\//g, ''));

/** Interfaces are looked up in these files, in order. */
const TYPE_FILES = ['index.d.ts', 'components/live/types.ts'];
function interfaceByName(/** @type {string} */ name) {
  for (const rel of TYPE_FILES) {
    const decl = findInterface(parse(src(rel)), name);
    if (decl) return { decl, file: rel };
  }
  throw new Error(`interface ${name} not found in ${TYPE_FILES.join(', ')}`);
}

/** `const { a = 1, b: c = 'x' } = Astro.props` → { a: '1', b: "'x'" } */
function destructuredDefaults(/** @type {ts.SourceFile} */ sf) {
  /** @type {Record<string, string>} */
  const out = {};
  const visit = (/** @type {ts.Node} */ node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer?.getText() === 'Astro.props' &&
      ts.isObjectBindingPattern(node.name)
    ) {
      for (const el of node.name.elements) {
        const key = (el.propertyName ?? el.name).getText();
        if (el.initializer) out[key] = oneLine(el.initializer.getText());
      }
    }
    // `const lang = Astro.props.lang ?? (…)`
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isBinaryExpression(node.initializer)) {
      const left = node.initializer.left.getText();
      const m = /^Astro\.props\.(\w+)$/.exec(left);
      if (m && node.initializer.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
        out[m[1]] = oneLine(node.initializer.right.getText()).replace(/^\((.*)\)$/, '$1');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function table(/** @type {string[]} */ head, /** @type {string[][]} */ rows) {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join(
    '\n',
  );
}

// ---------- generators ----------

/** Every projectSite() option, from index.d.ts (types and docs) and the zod schema (defaults, required). */
async function options() {
  const { optionsSchema } = await import(pathToFileURL(src('options.mjs')).href);
  const { decl } = interfaceByName('ProjectSiteOptions');
  const all = members(decl);
  const typed = all.filter((m) => !m.name.includes('.'));
  const schemaKeys = Object.keys(optionsSchema.shape);
  const typedKeys = typed.map((m) => m.name);
  const missing = schemaKeys.filter((k) => !typedKeys.includes(k));
  const extra = typedKeys.filter((k) => !schemaKeys.includes(k));
  if (missing.length || extra.length) {
    throw new Error(
      `options.mjs and index.d.ts disagree: only in the schema: ${missing.join(', ') || '-'}; only in the types: ${extra.join(', ') || '-'}`,
    );
  }
  const rows = all.map((m) => {
    if (m.name.includes('.')) return [`\`${m.name}\``, code(raw(m.type)), '', cell(m.doc)];
    const def = optionsSchema.shape[m.name].def;
    const required = !optionsSchema.shape[m.name].isOptional();
    if (required === m.optional) throw new Error(`option ${m.name}: optional in one of options.mjs / index.d.ts only`);
    let dflt = required ? '**required**' : '';
    if (def.type === 'default') dflt = code(JSON.stringify(def.defaultValue));
    return [`\`${m.name}\``, code(raw(m.type)), dflt, cell(m.doc)];
  });
  return table(['Option', 'Type', 'Default', 'Description'], rows);
}

/** One interface as a table. `defaults=components/live/Live.astro` adds defaults from a component's destructuring. */
function iface(/** @type {{ args: Record<string, string> }} */ { args }) {
  if (!args.name) throw new Error('gen:interface needs name=<Interface>');
  const { decl } = interfaceByName(args.name);
  const defaults = args.defaults ? destructuredDefaults(parse(src(args.defaults), frontmatter(src(args.defaults)))) : {};
  const withDefaults = !!args.defaults;
  const rows = members(decl).map((m) => [
    `\`${m.name}\``,
    code(raw(m.type)),
    ...(withDefaults ? [shownDefault(defaults[m.name])] : []),
    m.optional ? '' : 'yes',
    cell(m.doc),
  ]);
  return table(['Field', 'Type', ...(withDefaults ? ['Default'] : []), 'Required', 'Description'], rows);
}

function frontmatter(/** @type {string} */ file) {
  const m = /^---\n([\s\S]*?)\n---/.exec(read(file));
  if (!m) throw new Error(`${file} has no frontmatter`);
  return m[1];
}

/** The leading `//` comment of a component's frontmatter, up to the first empty comment line. */
function leadComment(/** @type {string} */ fm) {
  const lines = [];
  for (const line of fm.split('\n')) {
    const m = /^\/\/ ?(.*)$/.exec(line);
    if (!m || !m[1].trim()) break;
    lines.push(m[1]);
  }
  return oneLine(lines.join(' '));
}

/** Props of one .astro component: its `interface Props`, or the interface `type Props = X` names. */
function componentProps(/** @type {string} */ file) {
  const fm = frontmatter(file);
  const sf = parse(file, fm);
  let decl = findInterface(sf, 'Props');
  if (!decl) {
    const alias = sf.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === 'Props');
    if (alias && ts.isTypeAliasDeclaration(alias)) decl = interfaceByName(alias.type.getText()).decl;
  }
  const defaults = destructuredDefaults(sf);
  const body = read(file).slice(fm.length + 8);
  const slots = [...new Set([...body.matchAll(/<slot(?:\s+name="([^"]+)")?[\s/>]/g)].map((m) => m[1] ?? 'default'))];
  return { doc: leadComment(fm), props: decl ? members(decl) : [], defaults, slots };
}

/** Every component exported from astro-project-site/components, grouped as in components/index.ts. */
function components() {
  const index = read(src('components/index.ts'));
  const out = [];
  for (const line of index.split('\n')) {
    const group = /^\/\/ (.+)$/.exec(line);
    if (group && !/^Public components|^These are always/.test(group[1]) && group[1] !== 'Helpers') {
      out.push(`### ${group[1]}`);
      continue;
    }
    const m = /^export \{ default as (\w+) \} from '\.\/(.+\.astro)';$/.exec(line);
    if (!m) continue;
    const [, name, rel] = m;
    const info = componentProps(src(`components/${rel}`));
    out.push(`#### ${name}`, '', escapeHtml(info.doc), '');
    if (info.props.length) {
      out.push(
        table(
          ['Prop', 'Type', 'Default', 'Description'],
          info.props.map((p) => [
            `\`${p.name}\`${p.optional ? '' : ' (required)'}`,
            code(raw(p.type)),
            shownDefault(info.defaults[p.name]),
            cell(p.doc),
          ]),
        ),
        '',
      );
    } else out.push('No props.', '');
    if (info.slots.length) out.push(`Slots: ${info.slots.map(code).join(', ')}.`, '');
  }
  const helpers = /\/\/ Helpers\n([\s\S]*?)\n\n/.exec(index)?.[1] ?? '';
  const names = [...helpers.matchAll(/export \{ ([^}]+) \}/g)].flatMap((m) => m[1].split(',').map((s) => s.trim()));
  out.push('### Helpers', '', names.map((n) => `- \`${n}\``).join('\n'));
  return out.join('\n');
}

/** A `z.object({...})` in src/content.ts: field, type, default, doc. */
function schema(/** @type {{ args: Record<string, string> }} */ { args }) {
  const sf = parse(src(args.from ?? 'content.ts'));
  /** @type {ts.ObjectLiteralExpression | undefined} */
  let shape;
  const visit = (/** @type {ts.Node} */ node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText() === args.name) {
      const find = (/** @type {ts.Node} */ n) => {
        if (!shape && ts.isCallExpression(n) && /\bz\.object$/.test(n.expression.getText()) && n.arguments[0] && ts.isObjectLiteralExpression(n.arguments[0])) shape = n.arguments[0];
        ts.forEachChild(n, find);
      };
      find(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!shape) throw new Error(`gen:schema: z.object schema ${args.name} not found`);
  const rows = shape.properties.filter(ts.isPropertyAssignment).map((p) => {
    const chain = oneLine(p.initializer.getText());
    const base = /^(?:z\.)?(\w+)\((.*?)\)/.exec(chain);
    const kinds = /** @type {Record<string, string>} */ ({ string: 'string', number: 'number', boolean: 'boolean', image: 'image (local file)' });
    let type = base ? (kinds[base[1]] ?? base[1]) : chain;
    if (base?.[1] === 'array') type = `${/z\.(\w+)\(/.exec(base[2])?.[1] ?? 'unknown'}[]`;
    const dflt = /\.default\((.*)\)/.exec(chain)?.[1] ?? '';
    const required = !/\.optional\(\)|\.default\(/.test(chain);
    return [`\`${p.name.getText()}\``, code(type), dflt ? code(raw(dflt)) : '', required ? 'yes' : '', cell(jsDoc(p))];
  });
  return table(['Field', 'Type', 'Default', 'Required', 'Description'], rows);
}

/** The --site-* tokens from theme.css: value in the dark (default) and light theme. */
function tokens() {
  const css = read(src('styles/theme.css')).replace(/\/\*[\s\S]*?\*\//g, '');
  /** @type {Map<string, { dark?: string, light?: string, derived: boolean }>} */
  const all = new Map();
  let rootRules = 0;
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = oneLine(rule[1]);
    if (selector.includes('@layer')) continue;
    const light = selector === ":root[data-theme='light']";
    if (selector !== ':root' && !light) continue;
    // theme.css: brand tokens (dark `:root`, then light), then a second `:root` with the derived tokens.
    if (!light) rootRules++;
    for (const decl of rule[2].matchAll(/(--site-[\w-]+)\s*:\s*([^;]+);/g)) {
      const t = all.get(decl[1]) ?? { derived: rootRules > 1 };
      t[light ? 'light' : 'dark'] = oneLine(decl[2]);
      all.set(decl[1], t);
    }
  }
  const row = (/** @type {string} */ name, /** @type {any} */ t) => [`\`${name}\``, code(raw(t.dark ?? '')), t.light ? code(raw(t.light)) : 'same'];
  const brand = [...all].filter(([, t]) => !t.derived);
  const derived = [...all].filter(([, t]) => t.derived);
  return [
    '**Brand tokens** (override these):',
    '',
    table(['Token', 'Dark (default)', 'Light'], brand.map(([n, t]) => row(n, t))),
    '',
    '**Derived tokens** (computed from the brand tokens; usually leave alone):',
    '',
    table(['Token', 'Value', 'Light'], derived.map(([n, t]) => row(n, t))),
  ].join('\n');
}

function cli() {
  const help = execFileSync(process.execPath, [path.join(pkg, 'bin/project-site.mjs'), '--help'], { encoding: 'utf8' });
  return ['```text', help.trimEnd(), '```'].join('\n');
}

function file(/** @type {{ args: Record<string, string> }} */ { args }) {
  if (!args.from) throw new Error('gen:file needs from=<path in the package>');
  return [`\`\`\`${args.lang ?? ''} title="${args.from}"`, read(path.join(pkg, args.from)).trimEnd(), '```'].join('\n');
}

export default {
  files: ['../starters/default/example/docs', 'src/content/docs'],
  generators: {
    // The starter's generator resolves `from=` against the starter's root, so run it from there.
    exports: (/** @type {any} */ ctx) => starter.generators.exports({ ...ctx, root: path.resolve(ctx.root, '../starters/default') }),
    options,
    interface: iface,
    components,
    schema,
    tokens,
    cli,
    file,
  },
};
