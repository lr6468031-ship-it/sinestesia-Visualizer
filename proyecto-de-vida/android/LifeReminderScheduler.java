// SPDX-License-Identifier: AGPL-3.0-only
package com.proyectodevida.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TimeZone;

/** One OS alarm drives all routines; no background JS or per-routine alarm limit. */
public final class LifeReminderScheduler {
    static final String FIRE="com.proyectodevida.app.ROUTINE_REMINDER";
    static final String NORMAL="life_routines_v1", ALARM="life_alarm_sound_v1";
    private static SharedPreferences prefs(Context c){return c.getSharedPreferences("life-reminders",Context.MODE_PRIVATE);}
    static void channels(Context c){
        if(Build.VERSION.SDK_INT<26)return;
        NotificationManager manager=c.getSystemService(NotificationManager.class);
        NotificationChannel normal=new NotificationChannel(NORMAL,"Recordatorios de rutinas",NotificationManager.IMPORTANCE_HIGH);
        normal.setDescription("Avisos a la hora que elegiste para cada rutina.");normal.enableVibration(true);
        NotificationChannel alarm=new NotificationChannel(ALARM,"Rutinas con sonido de alarma",NotificationManager.IMPORTANCE_HIGH);
        alarm.setDescription("Notificaciones que usan el sonido de alarma del teléfono.");alarm.enableVibration(true);
        alarm.setSound(Settings.System.DEFAULT_ALARM_ALERT_URI,new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        manager.createNotificationChannel(normal);manager.createNotificationChannel(alarm);
    }
    static boolean exact(Context c){return Build.VERSION.SDK_INT<31||c.getSystemService(AlarmManager.class).canScheduleExactAlarms();}
    static List<ReminderTime.Plan> parse(JSONArray input)throws Exception{
        if(input.length()>10000)throw new IllegalArgumentException("Demasiadas rutinas.");
        List<ReminderTime.Plan> plans=new ArrayList<>();Set<String> ids=new HashSet<>();
        for(int i=0;i<input.length();i++){
            JSONObject j=input.getJSONObject(i);Set<Integer> days=new HashSet<>();Set<String> skip=new HashSet<>();
            JSONArray d=j.getJSONArray("days"),s=j.getJSONArray("skipDates");
            if(d.length()>7||s.length()>36600)throw new IllegalArgumentException("Horario inválido.");
            for(int k=0;k<d.length();k++)days.add(d.getInt(k));for(int k=0;k<s.length();k++)skip.add(s.getString(k));
            ReminderTime.Plan p=new ReminderTime.Plan(j.getString("id"),j.getString("title"),j.getString("startDate"),j.getString("time"),j.optString("endDate",""),days,skip,j.getString("mode"),j.optInt("minutes",0));
            if(!ids.add(p.id))throw new IllegalArgumentException("Rutina duplicada.");plans.add(p);
        }
        return plans;
    }
    private static List<ReminderTime.Plan> plans(Context c){try{return parse(new JSONArray(prefs(c).getString("plans","[]")));}catch(Exception e){return new ArrayList<>();}}
    private static String key(ReminderTime.Plan p,long at,TimeZone z){return ReminderTime.occurrenceDay(p,at,z)+"|"+p.id+"|"+p.time+"|"+p.mode+"|"+p.minutes;}
    private static long next(ReminderTime.Plan p,long after,TimeZone z,Set<String> fired){long at=ReminderTime.next(p,after,z);while(at!=ReminderTime.NONE&&fired.contains(key(p,at,z)))at=ReminderTime.next(p,at,z);return at;}
    private static PendingIntent delivery(Context c,long at){Intent i=new Intent(c,LifeReminderReceiver.class).setAction(FIRE).putExtra("at",at);return PendingIntent.getBroadcast(c,7101,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    private static PendingIntent open(Context c,String day,String id){Intent i=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("routine_day",day).putExtra("routine_id",id);i.setData(android.net.Uri.parse("life://routine/"+id+"/"+day));return PendingIntent.getActivity(c,0,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    public static synchronized void sync(Context c,JSONArray input)throws Exception{
        parse(input);SharedPreferences p=prefs(c);String previous=p.getString("plans","[]");
        // Remove visible reminders for tasks that were completed, deleted or changed.
        if(!previous.equals(input.toString())){NotificationManagerCompat manager=NotificationManagerCompat.from(c);JSONArray keep=new JSONArray();try{
            java.util.Map<String,String> oldPlans=new java.util.HashMap<>(),newPlans=new java.util.HashMap<>();JSONArray old=new JSONArray(previous);
            for(int i=0;i<old.length();i++)oldPlans.put(old.getJSONObject(i).getString("id"),old.getJSONObject(i).toString());
            for(int i=0;i<input.length();i++)newPlans.put(input.getJSONObject(i).getString("id"),input.getJSONObject(i).toString());
            JSONArray active=new JSONArray(p.getString("visible","[]"));for(int i=0;i<active.length();i++){String tag=active.getString(i),id=tag.substring(tag.indexOf('|')+1);if(!newPlans.containsKey(id)||!newPlans.get(id).equals(oldPlans.get(id)))manager.cancel(tag,1);else keep.put(tag);}
        }catch(Exception ignored){}p.edit().putString("visible",keep.toString()).apply();}
        if(!p.edit().putString("plans",input.toString()).commit())throw new IllegalStateException("No se pudo guardar el horario de avisos.");
        reschedule(c);
    }
    public static synchronized void reschedule(Context c){
        long pending=prefs(c).getLong("next",0);
        if(pending>0&&pending<=System.currentTimeMillis()){fire(c,pending);return;}
        channels(c);AlarmManager manager=c.getSystemService(AlarmManager.class);manager.cancel(delivery(c,0));
        SharedPreferences pref=prefs(c);long now=System.currentTimeMillis(),earliest=ReminderTime.NONE;boolean alarm=false;
        TimeZone zone=TimeZone.getDefault();Set<String> fired=new HashSet<>(pref.getStringSet("fired",new HashSet<>()));int count=0;
        if(NotificationManagerCompat.from(c).areNotificationsEnabled())for(ReminderTime.Plan p:plans(c)){
            if(Build.VERSION.SDK_INT>=26){NotificationChannel ch=c.getSystemService(NotificationManager.class).getNotificationChannel(p.mode.equals("alarm")?ALARM:NORMAL);if(ch!=null&&ch.getImportance()==NotificationManager.IMPORTANCE_NONE)continue;}
            long at=next(p,now,zone,fired);if(at!=ReminderTime.NONE){count++;if(at<earliest){earliest=at;alarm=p.mode.equals("alarm");}else if(at==earliest&&p.mode.equals("alarm"))alarm=true;}
        }
        pref.edit().putLong("next",earliest==ReminderTime.NONE?0:earliest).putInt("count",count).commit();
        if(earliest==ReminderTime.NONE)return;PendingIntent intent=delivery(c,earliest);
        try{if(exact(c)){if(alarm)manager.setAlarmClock(new AlarmManager.AlarmClockInfo(earliest,open(c,"","")),intent);else manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,earliest,intent);}else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,earliest,intent);}
        catch(SecurityException denied){manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,earliest,intent);}
    }
    public static synchronized void fire(Context c,long expected){
        SharedPreferences pref=prefs(c);long now=System.currentTimeMillis();
        if(expected==0||expected!=pref.getLong("next",0))return;
        if(now+1000<expected){reschedule(c);return;}
        Set<String> fired=new HashSet<>(pref.getStringSet("fired",new HashSet<>()));TimeZone zone=TimeZone.getDefault();List<ReminderTime.Plan> due=new ArrayList<>();
        if(now-expected<6*60*60*1000L)for(ReminderTime.Plan p:plans(c))if(next(p,expected-1,zone,fired)==expected){due.add(p);fired.add(key(p,expected,zone));}
        Calendar cutoff=Calendar.getInstance(zone);cutoff.add(Calendar.DAY_OF_MONTH,-28);String oldest=ReminderTime.day(cutoff);for(java.util.Iterator<String> iterator=fired.iterator();iterator.hasNext();)if(iterator.next().substring(0,10).compareTo(oldest)<0)iterator.remove();
        pref.edit().putLong("next",0).putStringSet("fired",fired).commit();reschedule(c);
        if(!NotificationManagerCompat.from(c).areNotificationsEnabled())return;
        JSONArray visible;try{visible=new JSONArray(pref.getString("visible","[]"));}catch(Exception e){visible=new JSONArray();}
        for(ReminderTime.Plan p:due){String day=ReminderTime.occurrenceDay(p,expected,zone),tag=day+"|"+p.id;boolean alarm=p.mode.equals("alarm");
            NotificationCompat.Builder builder=new NotificationCompat.Builder(c,alarm?ALARM:NORMAL).setSmallIcon(R.drawable.ic_life_notification).setContentTitle(p.title).setContentText((p.minutes>0?"Tu rutina empieza a las ":"Es hora de tu rutina · ")+p.time).setStyle(new NotificationCompat.BigTextStyle().bigText((p.minutes>0?p.minutes+" minutos antes. ":"")+"Abre Proyecto de vida para comenzar tu rutina de las "+p.time+".")).setContentIntent(open(c,day,p.id)).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH).setCategory(alarm?NotificationCompat.CATEGORY_ALARM:NotificationCompat.CATEGORY_REMINDER).setColor(0xff72e5ff).setSound(alarm?Settings.System.DEFAULT_ALARM_ALERT_URI:Settings.System.DEFAULT_NOTIFICATION_URI).setVibrate(new long[]{0,300,150,300});
            try{NotificationManagerCompat.from(c).notify(tag,1,builder.build());visible.put(tag);}catch(SecurityException ignored){}
        }
        pref.edit().putString("visible",visible.toString()).apply();
    }
    static JSONObject status(Context c,String permission)throws Exception{
        channels(c);JSONObject out=new JSONObject();out.put("permission",permission);out.put("exact",exact(c));out.put("scheduledCount",prefs(c).getInt("count",0));out.put("nextAt",prefs(c).getLong("next",0));
        boolean sound=true;if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=c.getSystemService(NotificationManager.class).getNotificationChannel(ALARM);sound=channel!=null&&channel.getSound()!=null&&channel.getImportance()>=NotificationManager.IMPORTANCE_DEFAULT;}out.put("alarmSound",sound);
        return out;
    }
    private LifeReminderScheduler(){}
}
