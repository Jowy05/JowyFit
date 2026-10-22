// Todo lo que cambia entre Android (Capacitor) y el navegador / iPhone (PWA) pasa por aquí.
// Cada función funciona en los dos sitios: en la web hace lo que puede o no hace nada.
// Se importa siempre desde este índice (las pruebas lo sustituyen entero con vi.doMock).
export * from './dispositivo'
export * from './sonido'
export * from './avisos'
export * from './salud'
export * from './escaner'
export * from './archivos'
