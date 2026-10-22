package com.proyectodevida.app;

import android.app.AlarmManager;
import android.app.Application;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import java.util.Calendar;
import java.util.Locale;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=30)
public class LifeReminderSchedulerTest {
    Context context;
    @Before public void setup(){context=RuntimeEnvironment.getApplication();context.getSharedPreferences("life-reminders",0).edit().clear().commit();context.getSystemService(NotificationManager.class).cancelAll();}
    JSONObject routine(String id,Calendar at)throws Exception{
        return new JSONObject().put("id",id).put("title","Ejercicio "+id).put("startDate",ReminderTime.day(at)).put("time",String.format(Locale.US,"%02d:%02d",at.get(Calendar.HOUR_OF_DAY),at.get(Calendar.MINUTE))).put("days",new JSONArray("[0,1,2,3,4,5,6]")).put("skipDates",new JSONArray()).put("endDate","").put("mode","alarm").put("minutes",0);
    }
    Calendar future(){Calendar at=Calendar.getInstance();at.add(Calendar.MINUTE,10);at.set(Calendar.SECOND,0);at.set(Calendar.MILLISECOND,0);return at;}
    @Test public void schedulesOneOperatingSystemAlarmForMultipleRoutinesWithoutAnActivity()throws Exception{
        Calendar at=future();JSONArray plans=new JSONArray().put(routine("one",at)).put(routine("two",at));
        LifeReminderScheduler.sync(context,plans);
        assertEquals(2,context.getSharedPreferences("life-reminders",0).getInt("count",0));
        assertEquals(at.getTimeInMillis(),context.getSharedPreferences("life-reminders",0).getLong("next",0));
        assertEquals(1,shadowOf(context.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
        assertEquals(Settings.System.DEFAULT_ALARM_ALERT_URI,context.getSystemService(NotificationManager.class).getNotificationChannel(LifeReminderScheduler.ALARM).getSound());
        assertEquals(android.media.AudioAttributes.USAGE_ALARM,context.getSystemService(NotificationManager.class).getNotificationChannel(LifeReminderScheduler.ALARM).getAudioAttributes().getUsage());
    }
    @Test public void receiverDeliversClosedAppRemindersOnceAndRearmsTomorrow()throws Exception{
        Calendar at=Calendar.getInstance();at.set(Calendar.SECOND,0);at.set(Calendar.MILLISECOND,0);JSONArray plans=new JSONArray().put(routine("one",at)).put(routine("two",at));
        LifeReminderScheduler.sync(context,plans);
        context.getSharedPreferences("life-reminders",0).edit().putLong("next",at.getTimeInMillis()).commit();
        Intent delivery=new Intent(LifeReminderScheduler.FIRE).putExtra("at",at.getTimeInMillis());
        new LifeReminderReceiver().onReceive(context,delivery);
        assertEquals(2,shadowOf(context.getSystemService(NotificationManager.class)).getAllNotifications().size());
        long tomorrow=context.getSharedPreferences("life-reminders",0).getLong("next",0);assertTrue(tomorrow>System.currentTimeMillis());
        new LifeReminderReceiver().onReceive(context,delivery);
        assertEquals(2,shadowOf(context.getSystemService(NotificationManager.class)).getAllNotifications().size());
        assertEquals(tomorrow,context.getSharedPreferences("life-reminders",0).getLong("next",0));
    }
    @Test public void completionSkipsOnlyThatDayAndDeletionCancelsTheAlarm()throws Exception{
        Calendar at=future();JSONObject plan=routine("one",at);LifeReminderScheduler.sync(context,new JSONArray().put(plan));
        plan.put("skipDates",new JSONArray().put(ReminderTime.day(at)));LifeReminderScheduler.sync(context,new JSONArray().put(plan));
        assertTrue(context.getSharedPreferences("life-reminders",0).getLong("next",0)>at.getTimeInMillis());
        LifeReminderScheduler.sync(context,new JSONArray());
        assertEquals(0,context.getSharedPreferences("life-reminders",0).getLong("next",0));
        assertEquals(0,shadowOf(context.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
    }
    @Test public void rebootRestoresSavedSchedulesWithoutOpeningTheApp()throws Exception{
        Calendar at=future();LifeReminderScheduler.sync(context,new JSONArray().put(routine("one",at)));
        new LifeReminderReceiver().onReceive(context,new Intent(Intent.ACTION_BOOT_COMPLETED));
        assertEquals(at.getTimeInMillis(),context.getSharedPreferences("life-reminders",0).getLong("next",0));
        assertEquals(1,shadowOf(context.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
    }
    @Test public void invalidReplacementLeavesThePreviousScheduleIntact()throws Exception{
        Calendar at=future();LifeReminderScheduler.sync(context,new JSONArray().put(routine("one",at)));String saved=context.getSharedPreferences("life-reminders",0).getString("plans","");
        try{LifeReminderScheduler.sync(context,new JSONArray().put(routine("bad",at).put("time","24:00")));fail("Invalid plan accepted");}catch(IllegalArgumentException expected){}
        assertEquals(saved,context.getSharedPreferences("life-reminders",0).getString("plans",""));
    }
    @Test public void blockedNotificationsKeepDataAndEnablingThemRestoresTheAlarm()throws Exception{
        Calendar at=future();shadowOf(context.getSystemService(NotificationManager.class)).setNotificationsEnabled(false);
        LifeReminderScheduler.sync(context,new JSONArray().put(routine("one",at)));
        assertEquals(0,context.getSharedPreferences("life-reminders",0).getLong("next",0));
        assertTrue(context.getSharedPreferences("life-reminders",0).getString("plans","").contains("one"));
        shadowOf(context.getSystemService(NotificationManager.class)).setNotificationsEnabled(true);LifeReminderScheduler.reschedule(context);
        assertEquals(at.getTimeInMillis(),context.getSharedPreferences("life-reminders",0).getLong("next",0));
    }
    @Test @Config(sdk=33) public void exactPermissionDenialFallsBackAndGrantUsesAndroidAlarmClock()throws Exception{
        Calendar at=future();AlarmManager manager=context.getSystemService(AlarmManager.class);
        shadowOf(manager).setCanScheduleExactAlarms(false);LifeReminderScheduler.sync(context,new JSONArray().put(routine("one",at)));
        assertFalse(LifeReminderScheduler.exact(context));assertEquals(1,shadowOf(manager).getScheduledAlarms().size());
        shadowOf(manager).setCanScheduleExactAlarms(true);LifeReminderScheduler.reschedule(context);
        assertTrue(LifeReminderScheduler.exact(context));assertNotNull(manager.getNextAlarmClock());assertEquals(at.getTimeInMillis(),manager.getNextAlarmClock().getTriggerTime());
    }
    @Test public void completionClearsItsNotificationAndKeepsOtherRoutinesVisible()throws Exception{
        Calendar at=Calendar.getInstance();at.set(Calendar.SECOND,0);at.set(Calendar.MILLISECOND,0);JSONObject first=routine("one",at),second=routine("two",at);
        LifeReminderScheduler.sync(context,new JSONArray().put(first).put(second));context.getSharedPreferences("life-reminders",0).edit().putLong("next",at.getTimeInMillis()).commit();LifeReminderScheduler.fire(context,at.getTimeInMillis());
        assertEquals(2,shadowOf(context.getSystemService(NotificationManager.class)).getAllNotifications().size());
        first.put("skipDates",new JSONArray().put(ReminderTime.day(at)));LifeReminderScheduler.sync(context,new JSONArray().put(first).put(second));
        assertEquals(1,shadowOf(context.getSystemService(NotificationManager.class)).getAllNotifications().size());
    }
    @Test public void openingTheAppAtTheDueTimeDoesNotCancelAnUndeliveredReminder()throws Exception{
        Calendar at=Calendar.getInstance();at.set(Calendar.SECOND,0);at.set(Calendar.MILLISECOND,0);LifeReminderScheduler.sync(context,new JSONArray().put(routine("one",at)));
        context.getSharedPreferences("life-reminders",0).edit().putLong("next",at.getTimeInMillis()).commit();
        LifeReminderScheduler.reschedule(context);
        assertEquals(1,shadowOf(context.getSystemService(NotificationManager.class)).getAllNotifications().size());
        assertTrue(context.getSharedPreferences("life-reminders",0).getLong("next",0)>System.currentTimeMillis());
    }
}
