// SPDX-License-Identifier: AGPL-3.0-only
package com.proyectodevida.app;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name="LifeReminders",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class LifeRemindersPlugin extends Plugin {
    private void resolve(PluginCall call){try{
        PermissionState current=getPermissionState("notifications");
        String permission=NotificationManagerCompat.from(getContext()).areNotificationsEnabled()?"granted":Build.VERSION.SDK_INT>=33&&(current==PermissionState.PROMPT||current==PermissionState.PROMPT_WITH_RATIONALE)?"prompt":"denied";
        JSObject response=JSObject.fromJSONObject(LifeReminderScheduler.status(getContext(),permission));
        String opened=getContext().getSharedPreferences("life-reminders",0).getString("openedDay","");
        if(!opened.isEmpty()){response.put("openedDay",opened);getContext().getSharedPreferences("life-reminders",0).edit().remove("openedDay").apply();}
        call.resolve(response);
    }catch(Exception e){call.reject("No se pudo comprobar el estado de los avisos.");}}
    @PluginMethod public void status(PluginCall call){resolve(call);}
    @PluginMethod public void sync(PluginCall call){try{LifeReminderScheduler.sync(getContext(),call.getArray("plans",new JSArray()));resolve(call);}catch(Exception e){call.reject("No se pudo guardar el horario de recordatorios.",e);}}
    @PluginMethod public void requestNotifications(PluginCall call){
        if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED)requestPermissionForAlias("notifications",call,"notificationsResult");
        else{LifeReminderScheduler.reschedule(getContext());resolve(call);}
    }
    @PermissionCallback private void notificationsResult(PluginCall call){LifeReminderScheduler.reschedule(getContext());resolve(call);}
    @PluginMethod public void openExactSettings(PluginCall call){try{if(Build.VERSION.SDK_INT>=31&&!LifeReminderScheduler.exact(getContext()))getActivity().startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getContext().getPackageName())));call.resolve();}catch(Exception e){call.reject("No pudimos abrir los ajustes de alarmas de Android.");}}
    @PluginMethod public void openNotificationSettings(PluginCall call){try{
        Intent intent=Build.VERSION.SDK_INT>=26?new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getContext().getPackageName()):new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getContext().getPackageName()));
        getActivity().startActivity(intent);call.resolve();
    }catch(Exception e){call.reject("No pudimos abrir los ajustes de notificaciones.");}}
}
