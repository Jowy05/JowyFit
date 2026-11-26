package com.jowy05.jowyfit;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

/**
 * Descarga verificada e instalación del APK oficial de JowyFit (GitHub Releases) desde la propia app.
 * - Solo admite URLs HTTPS del repositorio oficial Jowy05/JowyFit (y redirecciones HTTPS de GitHub).
 * - Comprueba la huella SHA-256 publicada en la release antes de abrir el instalador del sistema.
 * - Guarda el APK en cacheDir/compartir/ (ya expuesta por FileProvider en res/xml/file_paths.xml).
 */
@CapacitorPlugin(name = "ActualizacionApp")
public class ActualizacionApp extends Plugin {

    private static final Pattern URL_OFICIAL = Pattern.compile(
        "^https://github\\.com/Jowy05/JowyFit/releases/(?:download/v\\d+\\.\\d+\\.\\d+|latest/download)/JowyFit(?:-\\d+\\.\\d+\\.\\d+)?\\.apk$"
    );
    private static final Pattern SHA_HEX = Pattern.compile("^[0-9a-f]{64}$");
    private static final long MAX_BYTES = 150L * 1024L * 1024L;
    private static final int MAX_REDIRECCIONES = 5;
    private static final int TIMEOUT_CONEXION_MS = 15_000;
    private static final int TIMEOUT_LECTURA_MS = 30_000;
    private static final String ARCHIVO_APK = "JowyFit-actualizacion.apk";

    private static final ExecutorService EJECUTOR = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean DESCARGANDO = new AtomicBoolean(false);

    @PluginMethod
    public void puedeInstalar(PluginCall call) {
        JSObject r = new JSObject();
        r.put("permitido", tienePermisoInstalar(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void descargarEInstalar(PluginCall call) {
        String url = call.getString("url", "").trim();
        String shaEsperado = call.getString("sha256", "").trim().toLowerCase(Locale.ROOT);

        if (!URL_OFICIAL.matcher(url).matches()) {
            call.reject("Enlace de actualización no válido");
            return;
        }
        if (!shaEsperado.isEmpty() && !SHA_HEX.matcher(shaEsperado).matches()) {
            call.reject("Huella SHA-256 no válida");
            return;
        }

        Context ctx = getContext();
        if (!tienePermisoInstalar(ctx)) {
            abrirAjusteInstalar(ctx);
            JSObject r = new JSObject();
            r.put("estado", "permiso");
            call.resolve(r);
            return;
        }

        if (!DESCARGANDO.compareAndSet(false, true)) {
            call.reject("Ya hay una descarga en marcha");
            return;
        }

        EJECUTOR.execute(() -> {
            File carpeta = new File(ctx.getCacheDir(), "compartir");
            if (!carpeta.exists() && !carpeta.mkdirs()) {
                DESCARGANDO.set(false);
                call.reject("No se pudo preparar la carpeta de descarga");
                return;
            }
            File temporal = new File(carpeta, ARCHIVO_APK + ".tmp");
            File destino = new File(carpeta, ARCHIVO_APK);
            HttpURLConnection conn = null;

            try {
                conn = abrirConexionSegura(url);
                long total = conn.getContentLengthLong();
                if (total > MAX_BYTES) {
                    throw new IOException("El archivo es demasiado grande");
                }

                MessageDigest sha = MessageDigest.getInstance("SHA-256");
                long descargado = 0;
                int ultimoPorcentaje = -1;
                long ultimoAviso = 0;
                byte[] buf = new byte[32 * 1024];

                try (InputStream in = conn.getInputStream();
                     FileOutputStream out = new FileOutputStream(temporal)) {
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        descargado += n;
                        if (descargado > MAX_BYTES) {
                            throw new IOException("El archivo supera el tamaño máximo");
                        }
                        out.write(buf, 0, n);
                        sha.update(buf, 0, n);

                        int pct = total > 0 ? (int) Math.min(100, (descargado * 100L) / total) : -1;
                        long ahora = System.currentTimeMillis();
                        if ((pct != ultimoPorcentaje && (ahora - ultimoAviso >= 120 || pct == 100))
                            || (pct < 0 && ahora - ultimoAviso >= 250)) {
                            ultimoPorcentaje = pct;
                            ultimoAviso = ahora;
                            JSObject ev = new JSObject();
                            ev.put("porcentaje", pct);
                            ev.put("descargado", descargado);
                            ev.put("total", total);
                            notifyListeners("progreso", ev);
                        }
                    }
                    out.flush();
                }

                if (descargado == 0) {
                    throw new IOException("El archivo descargado está vacío");
                }

                if (!shaEsperado.isEmpty()) {
                    String calculado = hex(sha.digest());
                    if (!shaEsperado.equals(calculado)) {
                        throw new SecurityException("La huella SHA-256 no coincide con la versión publicada");
                    }
                }

                if (destino.exists() && !destino.delete()) {
                    throw new IOException("No se pudo sustituir el instalador anterior");
                }
                if (!temporal.renameTo(destino)) {
                    throw new IOException("No se pudo guardar el instalador");
                }

                Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", destino);
                Intent instalar = new Intent(Intent.ACTION_VIEW);
                instalar.setDataAndType(uri, "application/vnd.android.package-archive");
                instalar.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(instalar);

                JSObject r = new JSObject();
                r.put("estado", "instalando");
                call.resolve(r);
            } catch (SecurityException e) {
                borrarSilencioso(temporal);
                call.reject(e.getMessage());
            } catch (IOException | NoSuchAlgorithmException | RuntimeException e) {
                borrarSilencioso(temporal);
                call.reject("No se pudo descargar la actualización: " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
                DESCARGANDO.set(false);
            }
        });
    }

    private static boolean tienePermisoInstalar(Context ctx) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || ctx.getPackageManager().canRequestPackageInstalls();
    }

    private static void abrirAjusteInstalar(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (RuntimeException ignorada) {
            try {
                ctx.startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (RuntimeException ignored) { /* nada */ }
        }
    }

    /** Sigue solo redirecciones HTTPS dentro de github.com y *.githubusercontent.com. */
    private static HttpURLConnection abrirConexionSegura(String inicial) throws IOException {
        String actual = inicial;
        for (int salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
            URL u = new URL(actual);
            if (!"https".equalsIgnoreCase(u.getProtocol()) || !hostPermitido(u.getHost())) {
                throw new SecurityException("Destino de descarga no permitido");
            }
            HttpURLConnection conn = (HttpURLConnection) u.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(TIMEOUT_CONEXION_MS);
            conn.setReadTimeout(TIMEOUT_LECTURA_MS);
            conn.setRequestProperty("Accept", "application/octet-stream");
            conn.setRequestProperty("User-Agent", "JowyFit-Android");

            int code = conn.getResponseCode();
            if (code == HttpURLConnection.HTTP_MOVED_PERM
                || code == HttpURLConnection.HTTP_MOVED_TEMP
                || code == HttpURLConnection.HTTP_SEE_OTHER
                || code == 307
                || code == 308) {
                String destino = conn.getHeaderField("Location");
                conn.disconnect();
                if (destino == null || destino.isEmpty()) throw new IOException("Redirección vacía");
                actual = new URL(u, destino).toString();
                continue;
            }
            if (code < 200 || code >= 300) {
                conn.disconnect();
                throw new IOException("Respuesta del servidor (" + code + ")");
            }
            return conn;
        }
        throw new IOException("Demasiadas redirecciones");
    }

    private static boolean hostPermitido(String host) {
        if (host == null) return false;
        String h = host.toLowerCase(Locale.ROOT);
        return "github.com".equals(h) || h.endsWith(".githubusercontent.com");
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16));
            sb.append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }

    private static void borrarSilencioso(File f) {
        if (f != null && f.exists()) {
            //noinspection ResultOfMethodCallIgnored
            f.delete();
        }
    }
}
