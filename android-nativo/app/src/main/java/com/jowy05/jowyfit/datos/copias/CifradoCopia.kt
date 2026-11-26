package com.jowy05.jowyfit.datos.copias

import java.nio.ByteBuffer
import java.security.SecureRandom
import java.text.Normalizer
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Cifrado de copias .jowyfit 100 % compatible byte a byte con src/datos/cifrado.ts:
 * Cabecera (49 B): "JOWYFIT-CIFRADA-1" (17) + vueltas uint32 BE (4) + sal (16) + IV (12).
 * Cifrado: AES-256-GCM (tag 128 bits) usando la cabecera completa como AAD y PBKDF2-HMAC-SHA256.
 */
object CifradoCopia {
    const val MARCA_CIFRADA = "JOWYFIT-CIFRADA-1"
    private val MAGIA = MARCA_CIFRADA.toByteArray(Charsets.US_ASCII)
    private const val TAM_SAL = 16
    private const val TAM_IV = 12
    private val TAM_CABECERA = MAGIA.size + 4 + TAM_SAL + TAM_IV
    const val EXTRA_CIFRADO = 17 + 4 + 16 + 12 + 16

    const val VUELTAS = 600_000
    private const val VUELTAS_MIN = 600_000
    private const val VUELTAS_MAX = 2_000_000

    class ContrasenaMala : Exception("No es esta contraseña. Prueba otra vez.")

    private val rng = SecureRandom()

    fun esCifrada(bytes: ByteArray): Boolean {
        if (bytes.size < MAGIA.size) return false
        for (i in MAGIA.indices) {
            if (bytes[i] != MAGIA[i]) return false
        }
        return true
    }

    fun cifrar(zip: ByteArray, contrasena: String, vueltas: Int = VUELTAS): ByteArray {
        val sal = ByteArray(TAM_SAL).also { rng.nextBytes(it) }
        val iv = ByteArray(TAM_IV).also { rng.nextBytes(it) }
        val clave = derivarClave(contrasena, sal, vueltas)
        val cab = construirCabecera(vueltas, sal, iv)

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, clave, GCMParameterSpec(128, iv))
        cipher.updateAAD(cab)
        val cifrado = cipher.doFinal(zip)

        val out = ByteArray(cab.size + cifrado.size)
        System.arraycopy(cab, 0, out, 0, cab.size)
        System.arraycopy(cifrado, 0, out, cab.size, cifrado.size)
        return out
    }

    fun descifrar(bytes: ByteArray, contrasena: String): ByteArray {
        if (!esCifrada(bytes) || bytes.size < EXTRA_CIFRADO) {
            throw IllegalArgumentException("El archivo está dañado o no es una copia de JowyFit")
        }
        val vueltas = ByteBuffer.wrap(bytes, MAGIA.size, 4).int
        if (vueltas < VUELTAS_MIN || vueltas > VUELTAS_MAX) {
            throw IllegalArgumentException("El archivo está dañado o no es una copia de JowyFit")
        }
        val sal = bytes.copyOfRange(MAGIA.size + 4, MAGIA.size + 4 + TAM_SAL)
        val iv = bytes.copyOfRange(MAGIA.size + 4 + TAM_SAL, TAM_CABECERA)
        val cab = bytes.copyOfRange(0, TAM_CABECERA)
        val cuerpo = bytes.copyOfRange(TAM_CABECERA, bytes.size)

        val clave = derivarClave(contrasena, sal, vueltas)
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, clave, GCMParameterSpec(128, iv))
            cipher.updateAAD(cab)
            cipher.doFinal(cuerpo)
        } catch (_: AEADBadTagException) {
            throw ContrasenaMala()
        } catch (e: Exception) {
            throw ContrasenaMala()
        }
    }

    private fun derivarClave(contrasena: String, sal: ByteArray, vueltas: Int): SecretKeySpec {
        val normalizada = Normalizer.normalize(contrasena, Normalizer.Form.NFC)
        val spec = PBEKeySpec(normalizada.toCharArray(), sal, vueltas, 256)
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val keyBytes = factory.generateSecret(spec).encoded
        return SecretKeySpec(keyBytes, "AES")
    }

    private fun construirCabecera(vueltas: Int, sal: ByteArray, iv: ByteArray): ByteArray {
        val buf = ByteBuffer.allocate(TAM_CABECERA)
        buf.put(MAGIA)
        buf.putInt(vueltas)
        buf.put(sal)
        buf.put(iv)
        return buf.array()
    }
}
