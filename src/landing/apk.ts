// Datos del archivo APK que se descarga desde la landing (el de la última versión publicada en GitHub).
// Se actualizan a la vez que se sube un APK nuevo: versión, tamaño en bytes, fecha (AAAA-MM-DD) y la huella
// SHA-256 del archivo (en PowerShell: Get-FileHash apk\JowyFit-<versión>.apk; en Git Bash: sha256sum). Vacía hasta publicarlo:
// la landing solo la enseña si es de la misma versión.
// La landing solo enseña el tamaño y la fecha si «version» coincide con la de package.json: así nunca
// sale el tamaño de un APK que no es el que se va a descargar.
export const APK = {
  version: '0.10.0',
  bytes: 29_892_049,
  fecha: '2026-11-03',
  /** SHA-256 del APK publicado (64 caracteres hexadecimales). Se rellena al publicar la release. */
  sha256: '0f50eba7c4c73384fbd26c9f007f1a442dc57f46f051a7724247dceae236920b',
}
