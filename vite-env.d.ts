/// <reference types="vite/client" />
/**
 * Fix: Remove reference to vite/client to resolve "Cannot find type definition file"
 * and manually define ImportMetaEnv.
 */
interface ImportMetaEnv {
  readonly VITE_API_KEY: string;
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
