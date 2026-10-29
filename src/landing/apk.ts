// Datos del archivo APK que se descarga desde la landing (el de la última versión publicada en GitHub).
// Se actualizan a la vez que se sube un APK nuevo: versión, tamaño en bytes, fecha (AAAA-MM-DD) y la huella
// SHA-256 del archivo (en PowerShell: Get-FileHash apk\JowyFit-<versión>.apk; en Git Bash: sha256sum). Vacía hasta publicarlo:
// la landing solo la enseña si es de la misma versión.
// La landing solo enseña el tamaño y la fecha si «version» coincide con la de package.json: así nunca
// sale el tamaño de un APK que no es el que se va a descargar.
export const APK = {
  version: '0.9.0',
  bytes: 29_904_313,
  fecha: '2026-10-29',
  /** SHA-256 del APK publicado (64 caracteres hexadecimales). Se rellena al publicar la release. */
  sha256: '2668e38fa371e71153733ea82585f1eaf92ac8f30061a74435ad7f5c382ee081',
}
