// Datos del archivo APK que se descarga desde la landing (el de la última versión publicada en GitHub).
// Se actualizan a la vez que se sube un APK nuevo: versión, tamaño en bytes, fecha (AAAA-MM-DD) y la huella
// SHA-256 del archivo (en PowerShell: Get-FileHash apk\JowyFit-<versión>.apk; en Git Bash: sha256sum). Vacía hasta publicarlo:
// la landing solo la enseña si es de la misma versión.
// La landing solo enseña el tamaño y la fecha si «version» coincide con la de package.json: así nunca
// sale el tamaño de un APK que no es el que se va a descargar.
export const APK = {
  version: '0.8.1',
  bytes: 29_895_229,
  fecha: '2026-10-29',
  /** SHA-256 del APK publicado (64 caracteres hexadecimales). Se rellena al publicar la release. */
  sha256: '7b7ce25169fc5555213cbb5c3dfb61cb8b9b2ce09388fb859d49d9a90413ca8d',
}
