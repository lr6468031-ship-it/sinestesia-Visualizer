// SPDX-License-Identifier: AGPL-3.0-only
package com.proyectodevida.app;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LifeBackupPlugin.class);
        super.onCreate(savedInstanceState);
        int background = Color.rgb(5, 10, 24);
        getWindow().setBackgroundDrawable(new ColorDrawable(background));
        getWindow().setStatusBarColor(background);
        getWindow().setNavigationBarColor(background);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
            .setAppearanceLightStatusBars(false);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
            .setAppearanceLightNavigationBars(false);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null) { moveTaskToBack(true); return; }
                getBridge().getWebView().evaluateJavascript(
                    "(()=>{const d=document.querySelector('dialog[open]');" +
                    "if(d){d.querySelector('[data-action=\"close-modal\"]').click();return 'handled';}" +
                    "if(location.hash&&location.hash!=='#hoy'){location.hash='hoy';return 'handled';}" +
                    "return 'exit';})()",
                    result -> { if ("\"exit\"".equals(result)) moveTaskToBack(true); }
                );
            }
        });
    }
}
