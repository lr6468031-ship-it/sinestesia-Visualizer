// SPDX-License-Identifier: AGPL-3.0-only
package com.proyectodevida.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "LifeBackup")
public class LifeBackupPlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String contents = call.getString("contents");
        String name = call.getString("name", "proyecto-de-vida.json");
        if (contents == null || contents.getBytes(StandardCharsets.UTF_8).length > 2 * 1024 * 1024) {
            call.reject("El respaldo supera el límite de 2 MB.");
            return;
        }
        if (!name.matches("proyecto-de-vida(?:-[0-9-]+)?\\.json")) {
            call.reject("Nombre de respaldo inválido.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "backupCreated");
    }

    @ActivityCallback
    private void backupCreated(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject response = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK) {
            response.put("saved", false);
            call.resolve(response);
            return;
        }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (uri == null) { call.reject("No se seleccionó un archivo."); return; }
        try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (output == null) throw new java.io.IOException("No se pudo abrir el archivo.");
            output.write(call.getString("contents", "").getBytes(StandardCharsets.UTF_8));
            response.put("saved", true);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("No se pudo guardar el respaldo. Elige otra ubicación e inténtalo de nuevo.");
        }
    }
}
