/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" enables development tools in a production build (test deployments only). */
  readonly VITE_DEV_TOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
