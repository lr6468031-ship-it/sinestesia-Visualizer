// SPDX-License-Identifier: AGPL-3.0-only
package com.proyectodevida.app;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;
import java.util.TimeZone;

/** Civil-time calculation shared by alarm scheduling and its JVM tests. */
public final class ReminderTime {
    public static final long NONE = Long.MAX_VALUE;
    public static final class Plan {
        public final String id, title, start, time, end, mode;
        public final Set<Integer> days;
        public final Set<String> skip;
        public final int minutes;
        public Plan(String id, String title, String start, String time, String end,
                    Set<Integer> days, Set<String> skip, String mode, int minutes) {
            if (!id.matches("[\\w-]{1,80}") || title.isEmpty() || title.length() > 160
                || !time.matches("(?:[01]\\d|2[0-3]):[0-5]\\d")
                || !(mode.equals("alarm") || mode.equals("notification"))
                || !(minutes == 0 || minutes == 5 || minutes == 10 || minutes == 15 || minutes == 30 || minutes == 60))
                throw new IllegalArgumentException("Rutina inválida.");
            parseDay(start, TimeZone.getTimeZone("UTC"));
            if (!end.isEmpty()) parseDay(end, TimeZone.getTimeZone("UTC"));
            for (int day : days) if (day < 0 || day > 6) throw new IllegalArgumentException("Día inválido.");
            for (String date : skip) parseDay(date, TimeZone.getTimeZone("UTC"));
            this.id=id; this.title=title; this.start=start; this.time=time; this.end=end;
            this.days=new HashSet<>(days); this.skip=new HashSet<>(skip); this.mode=mode; this.minutes=minutes;
        }
    }
    public static Calendar parseDay(String day, TimeZone zone) {
        if (!day.matches("\\d{4}-\\d{2}-\\d{2}")) throw new IllegalArgumentException("Fecha inválida.");
        Calendar c=Calendar.getInstance(zone); c.clear(); c.setLenient(false);
        c.set(Integer.parseInt(day.substring(0,4)),Integer.parseInt(day.substring(5,7))-1,Integer.parseInt(day.substring(8,10)),12,0,0);
        c.getTimeInMillis(); c.setLenient(true); return c;
    }
    public static String day(Calendar c) {
        return String.format(java.util.Locale.US,"%04d-%02d-%02d",c.get(Calendar.YEAR),c.get(Calendar.MONTH)+1,c.get(Calendar.DAY_OF_MONTH));
    }
    public static String occurrenceDay(Plan p,long at,TimeZone zone) {
        Calendar c=Calendar.getInstance(zone); c.setTimeInMillis(at); c.add(Calendar.MINUTE,p.minutes); return day(c);
    }
    public static long next(Plan p,long after,TimeZone zone) {
        Calendar cursor=Calendar.getInstance(zone);cursor.setTimeInMillis(after);cursor.add(Calendar.MINUTE,p.minutes);
        String first=day(cursor);if(first.compareTo(p.start)<0)first=p.start;
        cursor=parseDay(first,zone);
        for(int i=0;i<36608;i++,cursor.add(Calendar.DAY_OF_MONTH,1)) {
            String date=day(cursor);
            if(!p.end.isEmpty()&&date.compareTo(p.end)>0)return NONE;
            if(p.days.isEmpty()&&!date.equals(p.start))return NONE;
            int weekday=(cursor.get(Calendar.DAY_OF_WEEK)+5)%7;
            if((!p.days.isEmpty()&&!p.days.contains(weekday))||p.skip.contains(date))continue;
            Calendar event=(Calendar)cursor.clone();
            event.set(Calendar.HOUR_OF_DAY,Integer.parseInt(p.time.substring(0,2)));
            event.set(Calendar.MINUTE,Integer.parseInt(p.time.substring(3,5)));event.set(Calendar.SECOND,0);event.set(Calendar.MILLISECOND,0);
            event.add(Calendar.MINUTE,-p.minutes);
            long at=event.getTimeInMillis();if(at>after)return at;
        }
        return NONE;
    }
    private ReminderTime() {}
}
