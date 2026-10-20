// Navegador para las pruebas de extremo a extremo: Edge o Chrome sin ventana, controlado por CDP.
// Sin dependencias: WebSocket y fetch de Node 22+.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CANDIDATOS = [
  process.env.E2E_NAVEGADOR,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

const esperar = ms => new Promise(r => setTimeout(r, ms))

export async function abrirNavegador({ puerto = 9555 } = {}) {
  const exe = CANDIDATOS.find(c => fs.existsSync(c))
  if (!exe) throw new Error('No encuentro Edge ni Chrome (usa E2E_NAVEGADOR)')
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'jowyfit-e2e-'))
  const proc = spawn(exe, [
    '--headless=new', `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
    '--window-size=390,844',
    // En los servidores de integración continua no hay sandbox de usuario.
    ...(process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
    'about:blank',
  ], { stdio: 'ignore' })
  let lista = null
  // Hasta 60 s: en la máquina de GitHub, Chrome a veces tarda más de 15 s en abrir la primera vez.
  for (let i = 0; i < 240 && !lista; i++) {
    try { lista = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json() } catch { await esperar(250) }
  }
  if (!lista) throw new Error('El navegador no arrancó')
  const pag = lista.find(p => p.type === 'page')
  const cdp = await conectar(pag.webSocketDebuggerUrl)
  return {
    cdp,
    async cerrar() {
      try { await cdp.enviar('Browser.close') } catch { /* ya cerrado */ }
      proc.kill()
      await esperar(400)
      try { fs.rmSync(perfil, { recursive: true, force: true }) } catch { /* Windows tarda en soltar archivos */ }
    },
  }
}

async function conectar(url) {
  const ws = new WebSocket(url)
  await new Promise((ok, mal) => { ws.addEventListener('open', ok); ws.addEventListener('error', mal) })
  let id = 0
  const pendientes = new Map()
  const oyentes = new Map()
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data)
    if (m.id && pendientes.has(m.id)) {
      const { ok, mal } = pendientes.get(m.id)
      pendientes.delete(m.id)
      if (m.error) mal(new Error(`${m.error.message} ${m.error.data ?? ''}`)); else ok(m.result)
    } else if (m.method) for (const f of oyentes.get(m.method) ?? []) f(m.params)
  })
  return {
    enviar: (method, params = {}) => new Promise((ok, mal) => { const n = ++id; pendientes.set(n, { ok, mal }); ws.send(JSON.stringify({ id: n, method, params })) }),
    al: (evento, f) => { oyentes.set(evento, [...(oyentes.get(evento) ?? []), f]) },
  }
}
