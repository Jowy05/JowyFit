import 'fake-indexeddb/auto'

// Todas las pruebas en hora de Madrid, también en la integración continua (que va en UTC). Aquí, antes de que
// cada archivo importe sus datos de ejemplo: un `process.env.TZ` dentro del archivo llega tarde para los imports.
process.env.TZ = 'Europe/Madrid'
