// SPDX-License-Identifier: AGPL-3.0-only
package com.proyectodevida.app;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.content.Intent;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LifeBackupPlugin.class);
        registerPlugin(LifeRemindersPlugin.class);
        super.onCreate(savedInstanceState);
        rememberRoutine(getIntent());
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
    private void rememberRoutine(Intent intent){
        String day=intent==null?null:intent.getStringExtra("routine_day");
        if(day!=null&&day.matches("\\d{4}-\\d{2}-\\d{2}"))getSharedPreferences("life-reminders",MODE_PRIVATE).edit().putString("openedDay",day).apply();
    }
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);rememberRoutine(intent);}
}
