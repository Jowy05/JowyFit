// Pruebas unitarias de actualizaciones in-app: comparación semver, validación estricta de URL/SHA-256 y fetch.
import { describe, expect, it, vi } from 'vitest'
import {
  compararVersion,
  extraerSha256,
  limpiarNotas,
  parsearRelease,
  tamanoMB,
  urlApkSegura,
  URL_RELEASES,
} from '../src/dominio/actualizacion'
import { buscarActualizacion } from '../src/plataforma/actualizaciones'

const SHA_EJEMPLO = 'a'.repeat(64)

describe('actualizaciones · semver y seguridad', () => {
  it('compara versiones semver con o sin prefijo v', () => {
    expect(compararVersion('0.13.0', '0.12.1')).toBe(1)
    expect(compararVersion('v1.0.0', '0.99.9')).toBe(1)
    expect(compararVersion('0.12.2', '0.12.1')).toBe(1)
    expect(compararVersion('v0.12.1', '0.12.1')).toBe(0)
    expect(compararVersion('0.12.0', '0.12.1')).toBe(-1)
    expect(compararVersion('0.11.9', '0.12.0')).toBe(-1)
    expect(compararVersion('raro', '0.12.1')).toBe(0)
    expect(compararVersion('0.12.1-beta', '0.12.1')).toBe(0)
  })

  it('extrae SHA-256 válido y limpia las notas para mostrarlas', () => {
    const body = `Novedades de prueba\n- Mejora A\n\nSHA-256 del APK: ${SHA_EJEMPLO.toUpperCase()}`
    expect(extraerSha256(body)).toBe(SHA_EJEMPLO)
    expect(limpiarNotas(body)).toBe('Novedades de prueba\n- Mejora A')
    expect(extraerSha256('SHA-256 del APK: corto123')).toBeNull()
    expect(extraerSha256('Sin huella')).toBeNull()
  })

  it('urlApkSegura solo acepta enlaces HTTPS oficiales del APK de Jowy05/JowyFit', () => {
    expect(urlApkSegura('https://github.com/Jowy05/JowyFit/releases/download/v0.13.0/JowyFit.apk')).toBe(true)
    expect(urlApkSegura('https://github.com/Jowy05/JowyFit/releases/download/v0.13.0/JowyFit-0.13.0.apk')).toBe(true)
    expect(urlApkSegura('https://github.com/Jowy05/JowyFit/releases/latest/download/JowyFit.apk')).toBe(true)

    const malas = [
      'http://github.com/Jowy05/JowyFit/releases/download/v0.13.0/JowyFit.apk',
      'https://github.com/otro/JowyFit/releases/download/v0.13.0/JowyFit.apk',
      'https://github.com.evil.example/Jowy05/JowyFit/releases/download/v0.13.0/JowyFit.apk',
      'https://github.com/Jowy05/JowyFit/releases/download/v0.13.0/malware.apk',
      'https://github.com/Jowy05/JowyFit/releases/download/v0.13.0/../../otro.apk',
      'javascript:alert(1)',
      '',
      null,
      123,
    ]
    for (const u of malas) expect(urlApkSegura(u), String(u)).toBe(false)
  })

  it('parsearRelease detecta versión nueva, asset oficial, tamaño, fecha y SHA-256', () => {
    const info = parsearRelease({
      tag_name: 'v0.13.0',
      body: `Retos diarios y mejoras\n\nSHA-256 del APK: ${SHA_EJEMPLO}`,
      html_url: 'https://github.com/Jowy05/JowyFit/releases/tag/v0.13.0',
      published_at: '2026-11-26T10:00:00Z',
      assets: [
        {
          name: 'JowyFit-0.13.0.apk',
          size: 39_198_282,
          browser_download_url: 'https://github.com/Jowy05/JowyFit/releases/download/v0.13.0/JowyFit-0.13.0.apk',
        },
        {
          name: 'JowyFit.apk',
          size: 39_198_282,
          browser_download_url: 'https://github.com/Jowy05/JowyFit/releases/download/v0.13.0/JowyFit.apk',
        },
      ],
    }, '0.12.1')

    expect(info).toEqual({
      actual: '0.12.1',
      ultima: '0.13.0',
      hayNueva: true,
      notas: 'Retos diarios y mejoras',
      urlApk: 'https://github.com/Jowy05/JowyFit/releases/download/v0.13.0/JowyFit.apk',
      urlRelease: 'https://github.com/Jowy05/JowyFit/releases/tag/v0.13.0',
      sha256: SHA_EJEMPLO,
      bytes: 39_198_282,
      fecha: '2026-11-26',
    })
    expect(tamanoMB(39_198_282)).toBe('37,4 MB')
  })

  it('parsearRelease ignora enlaces manipulados y cae a URL_RELEASES', () => {
    const info = parsearRelease({
      tag_name: 'v0.12.1',
      body: 'Notas',
      html_url: 'https://atacante.example/phishing',
      assets: [{ name: 'JowyFit.apk', size: 100, browser_download_url: 'https://atacante.example/JowyFit.apk' }],
    }, '0.12.1')
    expect(info?.hayNueva).toBe(false)
    expect(info?.urlApk).toBeNull()
    expect(info?.urlRelease).toBe(URL_RELEASES)
  })
})

describe('actualizaciones · buscarActualizacion', () => {
  it('devuelve ok: true cuando GitHub responde una release válida', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v0.14.0',
        body: `Cambios\n\nSHA-256 del APK: ${SHA_EJEMPLO}`,
        html_url: 'https://github.com/Jowy05/JowyFit/releases/tag/v0.14.0',
        assets: [{ name: 'JowyFit.apk', size: 30_000_000, browser_download_url: 'https://github.com/Jowy05/JowyFit/releases/download/v0.14.0/JowyFit.apk' }],
      }),
    }) as unknown as typeof fetch

    const r = await buscarActualizacion('0.12.1', mockFetch)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.info.hayNueva).toBe(true)
      expect(r.info.ultima).toBe('0.14.0')
      expect(r.info.sha256).toBe(SHA_EJEMPLO)
    }
  })

  it('devuelve error limpio cuando GitHub responde 403/500 o falla la red', async () => {
    const falloHttp = vi.fn().mockResolvedValue({ ok: false, status: 403 }) as unknown as typeof fetch
    expect(await buscarActualizacion('0.12.1', falloHttp)).toEqual({ ok: false, motivo: 'error' })

    const falloRed = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch
    const r = await buscarActualizacion('0.12.1', falloRed)
    expect(r.ok).toBe(false)
  })
})
