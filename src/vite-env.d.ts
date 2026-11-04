declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** "usuario/repo" de GitHub. Lo pone el workflow que compila el APK; en local queda vacío. */
  readonly VITE_REPO_GITHUB?: string
}
