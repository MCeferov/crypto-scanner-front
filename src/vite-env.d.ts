/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Cədvəldəki kripto cütlərinin sayı (default 40, maksimum 100) */
  readonly VITE_CRYPTO_LIMIT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
