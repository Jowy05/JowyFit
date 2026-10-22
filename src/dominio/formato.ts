// Ayudantes para escribir datos en pantalla.

/** Primera letra en mayúscula: «martes» → «Martes». */
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
