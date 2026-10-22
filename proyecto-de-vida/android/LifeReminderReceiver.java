// SPDX-License-Identifier: AGPL-3.0-only
package com.proyectodevida.app;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public class LifeReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){
        if(LifeReminderScheduler.FIRE.equals(intent.getAction()))LifeReminderScheduler.fire(context,intent.getLongExtra("at",0));
        else LifeReminderScheduler.reschedule(context);
    }
}
