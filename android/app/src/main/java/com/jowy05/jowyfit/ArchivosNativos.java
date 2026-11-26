package com.jowy05.jowyfit;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Guardado, elección de carpeta (SAF) y compartido fiable de copias (.jowyfit) y exportaciones en Android 8–16.
 * - Transfiere archivos por trozos (sin cadenas base64 gigantes por el puente WebView).
 * - En Android 10+ escribe en Documentos/JowyFit vía MediaStore (sin EACCES ni permisos de almacenamiento),
 *   con respaldo automático a Descargas/JowyFit si el fabricante restringe Documentos.
 * - Permite elegir destino con el selector del sistema (ACTION_CREATE_DOCUMENT) o compartir con FileProvider.
 */
@CapacitorPlugin(name = "ArchivosNativos")
public class ArchivosNativos extends Plugin {

    private static final String SUBCARPETA = "JowyFit";
    private static final String CARPETA_CACHE = "compartir";
    private static final String PREFIJO_TMP = "tmp-";
    private static final long CADUCIDAD_TMP_MS = 2L * 60L * 60L * 1000L;
    private static final int TAM_BLOQUE_LECTURA = 512 * 1024;
    private static final int MAX_LARGO_NOMBRE = 180;

    private static final ExecutorService EJECUTOR = Executors.newSingleThreadExecutor();
    private final Map<String, File> pendientes = new ConcurrentHashMap<>();
    private final Map<String, InputStream> lecturas = new ConcurrentHashMap<>();
    private volatile boolean detenidoEnCompartir = false;

    @Override
    protected void handleOnStop() {
        super.handleOnStop();
        detenidoEnCompartir = true;
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        EJECUTOR.execute(() -> {
            for (File f : pendientes.values()) borrarSilencioso(f);
            pendientes.clear();
            for (InputStream in : lecturas.values()) cerrarSilencioso(in);
            lecturas.clear();
        });
    }

    @PluginMethod
    public void iniciarArchivo(PluginCall call) {
        String nombre = call.getString("nombre", "").trim();
        if (!esNombreValido(nombre)) {
            call.reject("Nombre de archivo no válido");
            return;
        }
        Context ctx = getContext();
        EJECUTOR.execute(() -> {
            try {
                File carpeta = carpetaCache(ctx);
                limpiarTemporalesViejos(carpeta);
                String id = UUID.randomUUID().toString();
                File tmp = new File(carpeta, PREFIJO_TMP + id + ".bin");
                if (tmp.exists()) borrarSilencioso(tmp);
                if (!tmp.createNewFile()) {
                    call.reject("No se pudo preparar el archivo temporal");
                    return;
                }
                pendientes.put(id, tmp);
                JSObject r = new JSObject();
                r.put("id", id);
                call.resolve(r);
            } catch (IOException | RuntimeException e) {
                call.reject("No se pudo preparar el archivo: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void escribirTrozo(PluginCall call) {
        String id = call.getString("id", "");
        String datos = call.getString("datos");
        if (id.isEmpty() || datos == null) {
            call.reject("Faltan datos del archivo");
            return;
        }
        EJECUTOR.execute(() -> {
            File tmp = pendientes.get(id);
            if (tmp == null) {
                call.reject("El archivo temporal ya no existe");
                return;
            }
            try {
                byte[] bytes = Base64.decode(datos, Base64.DEFAULT);
                try (FileOutputStream out = new FileOutputStream(tmp, true)) {
                    out.write(bytes);
                }
                call.resolve();
            } catch (IOException | RuntimeException e) {
                call.reject("No se pudo escribir el archivo: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void cancelarArchivo(PluginCall call) {
        String id = call.getString("id", "");
        EJECUTOR.execute(() -> {
            borrarPendiente(id);
            call.resolve();
        });
    }

    @PluginMethod
    public void guardarEnDocumentos(PluginCall call) {
        String id = call.getString("id", "");
        String nombre = call.getString("nombre", "").trim();
        String tipo = call.getString("tipo", "");
        if (id.isEmpty() || !esNombreValido(nombre)) {
            call.reject("Datos de guardado no válidos");
            return;
        }
        Context ctx = getContext();
        EJECUTOR.execute(() -> {
            File tmp = pendientes.get(id);
            if (tmp == null || !tmp.exists()) {
                call.reject("El archivo temporal ya no existe");
                return;
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ResultadoGuardado res = guardarConMediaStore(ctx, tmp, nombre, tipo);
                    borrarPendiente(id);
                    JSObject r = new JSObject();
                    r.put("uri", res.uri);
                    r.put("carpeta", res.carpeta);
                    r.put("nombre", res.nombre);
                    call.resolve(r);
                    return;
                }
                if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    // Se mantiene el archivo temporal por si la app pide permiso y reintenta acto seguido.
                    call.reject("Sin permiso de almacenamiento", "SIN_PERMISO");
                    return;
                }
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), SUBCARPETA);
                if (!dir.exists() && !dir.mkdirs()) {
                    throw new IOException("No se pudo crear la carpeta Documentos/JowyFit");
                }
                File destino = new File(dir, nombre);
                copiarArchivo(tmp, destino);
                MediaScannerConnection.scanFile(ctx, new String[]{destino.getAbsolutePath()}, null, null);
                borrarPendiente(id);
                JSObject r = new JSObject();
                r.put("uri", Uri.fromFile(destino).toString());
                r.put("carpeta", "documentos");
                r.put("nombre", destino.getName());
                call.resolve(r);
            } catch (IOException | RuntimeException e) {
                borrarPendiente(id);
                call.reject("No se pudo guardar el archivo: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void guardarComo(PluginCall call) {
        String id = call.getString("id", "");
        String nombre = call.getString("nombre", "").trim();
        String tipo = call.getString("tipo", "");
        if (id.isEmpty() || !esNombreValido(nombre)) {
            call.reject("Datos de guardado no válidos");
            return;
        }
        File tmp = pendientes.get(id);
        if (tmp == null || !tmp.exists()) {
            call.reject("El archivo temporal ya no existe");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeSeguro(nombre, tipo));
        intent.putExtra(Intent.EXTRA_TITLE, nombre);
        Activity act = getActivity();
        if (act == null || act.isFinishing()) {
            EJECUTOR.execute(() -> borrarPendiente(id));
            call.reject("La pantalla no está activa");
            return;
        }
        act.runOnUiThread(() -> {
            try {
                startActivityForResult(call, intent, "alGuardarComo");
            } catch (RuntimeException e) {
                EJECUTOR.execute(() -> borrarPendiente(id));
                call.reject("No se pudo abrir el selector de carpetas: " + e.getMessage());
            }
        });
    }

    @ActivityCallback
    private void alGuardarComo(PluginCall call, ActivityResult result) {
        if (call == null) return;
        String id = call.getString("id", "");
        String nombre = call.getString("nombre", "");
        Intent data = result != null ? result.getData() : null;
        Uri destino = (result != null && result.getResultCode() == Activity.RESULT_OK && data != null) ? data.getData() : null;
        if (destino == null) {
            EJECUTOR.execute(() -> {
                borrarPendiente(id);
                JSObject r = new JSObject();
                r.put("estado", "cancelado");
                call.resolve(r);
            });
            return;
        }
        Context ctx = getContext();
        EJECUTOR.execute(() -> {
            File tmp = pendientes.get(id);
            if (tmp == null || !tmp.exists()) {
                call.reject("El archivo temporal ya no existe");
                return;
            }
            try (InputStream in = new FileInputStream(tmp);
                 OutputStream out = ctx.getContentResolver().openOutputStream(destino, "w")) {
                if (out == null) throw new IOException("No se pudo abrir el destino elegido");
                copiarFlujo(in, out);
                String nombreFinal = nombreDeUri(ctx, destino, nombre);
                JSObject r = new JSObject();
                r.put("estado", "guardado");
                r.put("uri", destino.toString());
                r.put("nombre", nombreFinal);
                call.resolve(r);
            } catch (IOException | RuntimeException e) {
                call.reject("No se pudo guardar en la carpeta elegida: " + e.getMessage());
            } finally {
                borrarPendiente(id);
            }
        });
    }

    @PluginMethod
    public void compartir(PluginCall call) {
        String id = call.getString("id", "");
        String nombre = call.getString("nombre", "").trim();
        String tipo = call.getString("tipo", "");
        String titulo = call.getString("titulo", nombre);
        if (id.isEmpty() || !esNombreValido(nombre)) {
            call.reject("Datos de compartido no válidos");
            return;
        }
        Context ctx = getContext();
        EJECUTOR.execute(() -> {
            File tmp = pendientes.remove(id);
            if (tmp == null || !tmp.exists()) {
                call.reject("El archivo temporal ya no existe");
                return;
            }
            try {
                File carpeta = carpetaCache(ctx);
                File destino = new File(carpeta, nombre);
                if (destino.exists()) borrarSilencioso(destino);
                if (!tmp.renameTo(destino)) {
                    copiarArchivo(tmp, destino);
                    borrarSilencioso(tmp);
                }
                lanzarCompartir(call, ctx, destino, mimeSeguro(nombre, tipo), titulo);
            } catch (IOException | RuntimeException e) {
                borrarSilencioso(tmp);
                call.reject("No se pudo preparar el archivo para compartir: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void compartirCopiaGuardada(PluginCall call) {
        String nombre = call.getString("nombre", "").trim();
        String titulo = call.getString("titulo", nombre);
        if (!esNombreCopiaValido(nombre)) {
            call.reject("Nombre de copia no válido");
            return;
        }
        Context ctx = getContext();
        EJECUTOR.execute(() -> {
            try (InputStream in = abrirCopiaGuardada(ctx, nombre)) {
                if (in == null) {
                    call.reject("No se encuentra esa copia en el móvil");
                    return;
                }
                File destino = new File(carpetaCache(ctx), nombre);
                if (destino.exists()) borrarSilencioso(destino);
                try (FileOutputStream out = new FileOutputStream(destino)) {
                    copiarFlujo(in, out);
                }
                lanzarCompartir(call, ctx, destino, "application/octet-stream", titulo);
            } catch (IOException | RuntimeException e) {
                call.reject("No se pudo compartir la copia: " + e.getMessage());
            }
        });
    }

    @ActivityCallback
    private void alCompartir(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        boolean cancelado = result != null && result.getResultCode() == Activity.RESULT_CANCELED && !detenidoEnCompartir;
        r.put("estado", cancelado ? "cancelado" : "compartido");
        call.resolve(r);
    }

    @PluginMethod
    public void listarCopias(PluginCall call) {
        Context ctx = getContext();
        EJECUTOR.execute(() -> {
            try {
                Map<String, InfoCopia> porNombre = new LinkedHashMap<>();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    listarDesdeMediaStore(ctx, porNombre);
                }
                listarDesdeCarpetaDirecta(porNombre);
                List<InfoCopia> lista = new ArrayList<>(porNombre.values());
                Collections.sort(lista, (a, b) -> {
                    int cmp = Long.compare(b.fecha, a.fecha);
                    return cmp != 0 ? cmp : b.nombre.compareTo(a.nombre);
                });
                JSArray arr = new JSArray();
                for (InfoCopia c : lista) {
                    JSObject o = new JSObject();
                    o.put("nombre", c.nombre);
                    o.put("fecha", c.fecha);
                    o.put("tam", c.tam);
                    arr.put(o);
                }
                JSObject r = new JSObject();
                r.put("copias", arr);
                call.resolve(r);
            } catch (RuntimeException e) {
                JSObject r = new JSObject();
                r.put("copias", new JSArray());
                call.resolve(r);
            }
        });
    }

    @PluginMethod
    public void abrirLecturaCopia(PluginCall call) {
        String nombre = call.getString("nombre", "").trim();
        if (!esNombreCopiaValido(nombre)) {
            call.reject("Nombre de copia no válido");
            return;
        }
        Context ctx = getContext();
        EJECUTOR.execute(() -> {
            try {
                InputStream in = abrirCopiaGuardada(ctx, nombre);
                if (in == null) {
                    call.reject("No se encuentra esa copia en el móvil");
                    return;
                }
                String id = UUID.randomUUID().toString();
                lecturas.put(id, in);
                JSObject r = new JSObject();
                r.put("id", id);
                call.resolve(r);
            } catch (IOException | RuntimeException e) {
                call.reject("No se pudo abrir la copia: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void leerTrozoCopia(PluginCall call) {
        String id = call.getString("id", "");
        EJECUTOR.execute(() -> {
            InputStream in = lecturas.get(id);
            if (in == null) {
                call.reject("La lectura ya se cerró");
                return;
            }
            try {
                byte[] buf = new byte[TAM_BLOQUE_LECTURA];
                int n = in.read(buf);
                if (n <= 0) {
                    cerrarLecturaInterna(id);
                    JSObject r = new JSObject();
                    r.put("datos", "");
                    r.put("fin", true);
                    call.resolve(r);
                    return;
                }
                String b64 = Base64.encodeToString(buf, 0, n, Base64.NO_WRAP);
                JSObject r = new JSObject();
                r.put("datos", b64);
                r.put("fin", false);
                call.resolve(r);
            } catch (IOException | RuntimeException e) {
                cerrarLecturaInterna(id);
                call.reject("No se pudo leer la copia: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void cerrarLecturaCopia(PluginCall call) {
        String id = call.getString("id", "");
        EJECUTOR.execute(() -> {
            cerrarLecturaInterna(id);
            call.resolve();
        });
    }

    @PluginMethod
    public void borrarCopia(PluginCall call) {
        String nombre = call.getString("nombre", "").trim();
        if (!esNombreCopiaValido(nombre)) {
            call.reject("Nombre de copia no válido");
            return;
        }
        Context ctx = getContext();
        EJECUTOR.execute(() -> {
            boolean borrada = false;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    Uri uri = buscarEnMediaStore(ctx, nombre);
                    if (uri != null) {
                        borrada = ctx.getContentResolver().delete(uri, null, null) > 0;
                    }
                }
                File directo = archivoDirectoDocumentos(nombre);
                if (directo.exists() && directo.delete()) {
                    borrada = true;
                }
                if (!borrada) {
                    call.reject("No se pudo borrar la copia");
                    return;
                }
                call.resolve();
            } catch (RuntimeException e) {
                call.reject("No se pudo borrar la copia: " + e.getMessage());
            }
        });
    }

    private void lanzarCompartir(PluginCall call, Context ctx, File archivo, String mime, String titulo) {
        Activity act = getActivity();
        if (act == null || act.isFinishing()) {
            call.reject("La pantalla no está activa");
            return;
        }
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", archivo);
        Intent enviar = new Intent(Intent.ACTION_SEND);
        enviar.setType(mime);
        enviar.putExtra(Intent.EXTRA_STREAM, uri);
        enviar.putExtra(Intent.EXTRA_SUBJECT, titulo != null ? titulo : archivo.getName());
        enviar.setClipData(ClipData.newRawUri("", uri));
        enviar.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent chooser = Intent.createChooser(enviar, titulo != null ? titulo : archivo.getName());
        chooser.addCategory(Intent.CATEGORY_DEFAULT);
        act.runOnUiThread(() -> {
            try {
                detenidoEnCompartir = false;
                startActivityForResult(call, chooser, "alCompartir");
            } catch (RuntimeException e) {
                call.reject("No se pudo abrir el menú Compartir: " + e.getMessage());
            }
        });
    }

    private static ResultadoGuardado guardarConMediaStore(Context ctx, File origen, String nombre, String tipo) throws IOException {
        String mime = mimeSeguro(nombre, tipo);
        try {
            return insertarEnMediaStore(
                ctx,
                MediaStore.Files.getContentUri("external"),
                Environment.DIRECTORY_DOCUMENTS + "/" + SUBCARPETA,
                origen,
                nombre,
                mime,
                "documentos"
            );
        } catch (IOException | RuntimeException falloDocumentos) {
            return insertarEnMediaStore(
                ctx,
                MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                Environment.DIRECTORY_DOWNLOADS + "/" + SUBCARPETA,
                origen,
                nombre,
                mime,
                "descargas"
            );
        }
    }

    private static ResultadoGuardado insertarEnMediaStore(
        Context ctx,
        Uri coleccion,
        String rutaRelativa,
        File origen,
        String nombre,
        String mime,
        String etiquetaCarpeta
    ) throws IOException {
        ContentResolver cr = ctx.getContentResolver();
        ContentValues valores = new ContentValues();
        valores.put(MediaStore.MediaColumns.DISPLAY_NAME, nombre);
        valores.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        valores.put(MediaStore.MediaColumns.RELATIVE_PATH, rutaRelativa);
        valores.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = cr.insert(coleccion, valores);
        if (uri == null) {
            throw new IOException("MediaStore no devolvió destino");
        }
        try {
            try (InputStream in = new FileInputStream(origen);
                 OutputStream out = cr.openOutputStream(uri, "w")) {
                if (out == null) throw new IOException("No se pudo abrir el destino");
                copiarFlujo(in, out);
            }
            ContentValues listo = new ContentValues();
            listo.put(MediaStore.MediaColumns.IS_PENDING, 0);
            cr.update(uri, listo, null, null);
            String nombreFinal = nombreDeUri(ctx, uri, nombre);
            return new ResultadoGuardado(uri.toString(), etiquetaCarpeta, nombreFinal);
        } catch (IOException | RuntimeException e) {
            try { cr.delete(uri, null, null); } catch (RuntimeException ignorada) { /* nada */ }
            throw e;
        }
    }

    private static void listarDesdeMediaStore(Context ctx, Map<String, InfoCopia> porNombre) {
        Uri coleccion = MediaStore.Files.getContentUri("external");
        String[] cols = {
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.DATE_MODIFIED,
            MediaStore.MediaColumns.SIZE,
        };
        String sel = MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ? AND "
            + MediaStore.MediaColumns.RELATIVE_PATH + " IN (?, ?, ?, ?)";
        String[] args = {
            "%.jowyfit",
            Environment.DIRECTORY_DOCUMENTS + "/" + SUBCARPETA + "/",
            Environment.DIRECTORY_DOCUMENTS + "/" + SUBCARPETA,
            Environment.DIRECTORY_DOWNLOADS + "/" + SUBCARPETA + "/",
            Environment.DIRECTORY_DOWNLOADS + "/" + SUBCARPETA,
        };
        try (Cursor c = ctx.getContentResolver().query(coleccion, cols, sel, args, MediaStore.MediaColumns.DATE_MODIFIED + " DESC")) {
            if (c == null) return;
            int idxNombre = c.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME);
            int idxFecha = c.getColumnIndex(MediaStore.MediaColumns.DATE_MODIFIED);
            int idxTam = c.getColumnIndex(MediaStore.MediaColumns.SIZE);
            while (c.moveToNext()) {
                String nombre = idxNombre >= 0 ? c.getString(idxNombre) : null;
                if (nombre == null || !esNombreCopiaValido(nombre)) continue;
                long fecha = idxFecha >= 0 ? c.getLong(idxFecha) * 1000L : 0L;
                long tam = idxTam >= 0 ? c.getLong(idxTam) : 0L;
                InfoCopia previa = porNombre.get(nombre);
                if (previa == null || fecha > previa.fecha) {
                    porNombre.put(nombre, new InfoCopia(nombre, fecha, tam));
                }
            }
        }
    }

    private static void listarDesdeCarpetaDirecta(Map<String, InfoCopia> porNombre) {
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), SUBCARPETA);
        File[] archivos = dir.listFiles();
        if (archivos == null) return;
        for (File f : archivos) {
            if (!f.isFile()) continue;
            String nombre = f.getName();
            if (!esNombreCopiaValido(nombre)) continue;
            long fecha = f.lastModified();
            long tam = f.length();
            InfoCopia previa = porNombre.get(nombre);
            if (previa == null || fecha > previa.fecha) {
                porNombre.put(nombre, new InfoCopia(nombre, fecha, tam));
            }
        }
    }

    private static Uri buscarEnMediaStore(Context ctx, String nombre) {
        Uri coleccion = MediaStore.Files.getContentUri("external");
        String[] cols = { MediaStore.MediaColumns._ID };
        String sel = MediaStore.MediaColumns.DISPLAY_NAME + " = ? AND "
            + MediaStore.MediaColumns.RELATIVE_PATH + " IN (?, ?, ?, ?)";
        String[] args = {
            nombre,
            Environment.DIRECTORY_DOCUMENTS + "/" + SUBCARPETA + "/",
            Environment.DIRECTORY_DOCUMENTS + "/" + SUBCARPETA,
            Environment.DIRECTORY_DOWNLOADS + "/" + SUBCARPETA + "/",
            Environment.DIRECTORY_DOWNLOADS + "/" + SUBCARPETA,
        };
        try (Cursor c = ctx.getContentResolver().query(coleccion, cols, sel, args, MediaStore.MediaColumns.DATE_MODIFIED + " DESC")) {
            if (c != null && c.moveToFirst()) {
                long id = c.getLong(0);
                return ContentUris.withAppendedId(coleccion, id);
            }
        }
        return null;
    }

    private static InputStream abrirCopiaGuardada(Context ctx, String nombre) throws IOException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            Uri uri = buscarEnMediaStore(ctx, nombre);
            if (uri != null) {
                InputStream in = ctx.getContentResolver().openInputStream(uri);
                if (in != null) return in;
            }
        }
        File directo = archivoDirectoDocumentos(nombre);
        if (directo.isFile() && directo.canRead()) {
            return new FileInputStream(directo);
        }
        return null;
    }

    private static File archivoDirectoDocumentos(String nombre) {
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), SUBCARPETA);
        return new File(dir, nombre);
    }

    private static String nombreDeUri(Context ctx, Uri uri, String respaldo) {
        try (Cursor c = ctx.getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                String n = c.getString(0);
                if (n != null && !n.trim().isEmpty()) return n.trim();
            }
        } catch (RuntimeException ignorada) { /* nada */ }
        return respaldo;
    }

    /**
     * Para .jowyfit siempre application/octet-stream: con application/zip Android añade ".zip" al nombre en MediaStore
     * y en ACTION_CREATE_DOCUMENT.
     */
    private static String mimeSeguro(String nombre, String tipo) {
        String bajo = nombre.toLowerCase(Locale.ROOT);
        if (bajo.endsWith(".jowyfit")) return "application/octet-stream";
        if (bajo.endsWith(".csv")) return "text/csv";
        if (bajo.endsWith(".json")) return "application/json";
        if (bajo.endsWith(".pdf")) return "application/pdf";
        if (tipo != null && !tipo.trim().isEmpty()) {
            String limpio = tipo.split(";")[0].trim();
            if (!limpio.isEmpty()) return limpio;
        }
        return "application/octet-stream";
    }

    private static boolean esNombreValido(String nombre) {
        if (nombre == null || nombre.isEmpty() || nombre.length() > MAX_LARGO_NOMBRE) return false;
        if (nombre.contains("/") || nombre.contains("\\") || nombre.contains("..")) return false;
        for (int i = 0; i < nombre.length(); i++) {
            if (nombre.charAt(i) < 0x20) return false;
        }
        return true;
    }

    private static boolean esNombreCopiaValido(String nombre) {
        return esNombreValido(nombre) && nombre.endsWith(".jowyfit");
    }

    private static File carpetaCache(Context ctx) throws IOException {
        File dir = new File(ctx.getCacheDir(), CARPETA_CACHE);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("No se pudo crear la carpeta temporal");
        }
        return dir;
    }

    private static void limpiarTemporalesViejos(File carpeta) {
        File[] archivos = carpeta.listFiles();
        if (archivos == null) return;
        long corte = System.currentTimeMillis() - CADUCIDAD_TMP_MS;
        for (File f : archivos) {
            if (f.isFile() && f.getName().startsWith(PREFIJO_TMP) && f.lastModified() < corte) {
                borrarSilencioso(f);
            }
        }
    }

    private void borrarPendiente(String id) {
        if (id == null || id.isEmpty()) return;
        File tmp = pendientes.remove(id);
        borrarSilencioso(tmp);
    }

    private void cerrarLecturaInterna(String id) {
        if (id == null || id.isEmpty()) return;
        InputStream in = lecturas.remove(id);
        cerrarSilencioso(in);
    }

    private static void copiarArchivo(File origen, File destino) throws IOException {
        try (InputStream in = new FileInputStream(origen);
             OutputStream out = new FileOutputStream(destino)) {
            copiarFlujo(in, out);
        }
    }

    private static void copiarFlujo(InputStream in, OutputStream out) throws IOException {
        byte[] buf = new byte[64 * 1024];
        int n;
        while ((n = in.read(buf)) != -1) {
            out.write(buf, 0, n);
        }
        out.flush();
    }

    private static void borrarSilencioso(File f) {
        if (f != null && f.exists()) {
            //noinspection ResultOfMethodCallIgnored
            f.delete();
        }
    }

    private static void cerrarSilencioso(InputStream in) {
        if (in != null) {
            try { in.close(); } catch (IOException ignorada) { /* nada */ }
        }
    }

    private static final class ResultadoGuardado {
        final String uri;
        final String carpeta;
        final String nombre;

        ResultadoGuardado(String uri, String carpeta, String nombre) {
            this.uri = uri;
            this.carpeta = carpeta;
            this.nombre = nombre;
        }
    }

    private static final class InfoCopia {
        final String nombre;
        final long fecha;
        final long tam;

        InfoCopia(String nombre, long fecha, long tam) {
            this.nombre = nombre;
            this.fecha = fecha;
            this.tam = tam;
        }
    }
}
