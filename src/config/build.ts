/**
 * Build flags. Development tools (item grants, test pickups on altars, save
 * reset) exist only in `npm run dev` and in test deployments built with
 * VITE_DEV_TOOLS=true (the GitHub Pages preview). A plain `npm run build`, the
 * basis for commercial releases, compiles them out entirely.
 */
export const DEV_TOOLS_ENABLED: boolean = import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === 'true';
