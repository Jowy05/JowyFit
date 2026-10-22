// Escáner de códigos de barras nativo (Android). El de la cámara web está en escanerWeb.ts.
import { esAndroid } from './dispositivo'

/** Android: escáner nativo de Google (ML Kit). Devuelve null si no hay escáner nativo. */
export async function escanearNativo(): Promise<string | null | 'cancelado'> {
  if (!esAndroid()) return null
  try {
    const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning')
    if (!(await BarcodeScanner.isSupported()).supported) return null
    const mod = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable().catch(() => ({ available: true }))
    if (!mod.available) { await BarcodeScanner.installGoogleBarcodeScannerModule().catch(() => {}); }
    try {
      const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE] })
      return barcodes[0]?.rawValue ?? 'cancelado'
    } catch {
      // El escáner de Google ya se abrió: cerrarlo da «Failed to scan code» (no dice «cancel»).
      // No se cae a la cámara web, que en Android no tiene permiso: se ofrece escribir el código.
      return 'cancelado'
    }
  } catch {
    return null
  }
}
