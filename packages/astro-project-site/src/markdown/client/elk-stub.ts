// Stands in for `elkjs` (EPL-2.0), which Mermaid imports for its `elk` layout engine (Mermaid 12's default; the
// client sets `layout: 'dagre'`). Keeping it out
// keeps the site's JavaScript MIT/ISC/Apache-licensed and saves a 1.5 MB chunk. A diagram that asks for ELK fails
// to render and shows its source instead; the default layout (dagre) is unaffected.
export default class ELK {
  layout(): Promise<never> {
    return Promise.reject(new Error('The ELK layout engine is not included; use the default layout.'));
  }
}
