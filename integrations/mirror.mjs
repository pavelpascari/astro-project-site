// OWNER: deploy agent. Copies static apps listed in site.config `mirrors` into the build, and serves them in dev.
export function mirror(site) {
  return { name: 'project-site:mirror', hooks: {} };
}
