package com.proyectodevida.app;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.TimeZone;
import java.time.ZonedDateTime;

public class ReminderTimeTest {
    static long at(String value){return ZonedDateTime.parse(value).toInstant().toEpochMilli();}
    static void equal(long actual,long expected){if(actual!=expected)throw new AssertionError(actual+" != "+expected);}
    static ReminderTime.Plan plan(String start,String time,Set<Integer> days,Set<String> skip,String end,int minutes){return new ReminderTime.Plan("exercise","Ejercicio",start,time,end,days,skip,"alarm",minutes);}
    public static void main(String[] args){
        TimeZone lima=TimeZone.getTimeZone("America/Lima"),ny=TimeZone.getTimeZone("America/New_York");
        Set<Integer> mwf=new HashSet<>(Arrays.asList(0,2,4));
        ReminderTime.Plan p=plan("2026-10-21","14:00",mwf,Collections.emptySet(),"",0);
        equal(ReminderTime.next(p,at("2026-10-21T13:59:59-05:00"),lima),at("2026-10-21T14:00:00-05:00"));
        equal(ReminderTime.next(p,at("2026-10-21T14:00:00-05:00"),lima),at("2026-10-23T14:00:00-05:00"));
        equal(ReminderTime.next(plan("2026-11-01","14:00",mwf,Collections.emptySet(),"",0),at("2026-10-21T12:00:00-05:00"),lima),at("2026-11-02T14:00:00-05:00"));
        equal(ReminderTime.next(plan("2026-10-21","14:00",mwf,new HashSet<>(Arrays.asList("2026-10-21","2026-10-23")),"",0),at("2026-10-21T12:00:00-05:00"),lima),at("2026-10-26T14:00:00-05:00"));
        equal(ReminderTime.next(plan("2026-10-21","14:00",mwf,Collections.emptySet(),"2026-10-22",0),at("2026-10-21T14:00:00-05:00"),lima),ReminderTime.NONE);
        equal(ReminderTime.next(plan("2026-10-21","14:00",Collections.emptySet(),Collections.emptySet(),"",0),at("2026-10-21T14:00:00-05:00"),lima),ReminderTime.NONE);
        ReminderTime.Plan midnight=plan("2026-10-22","00:15",Collections.emptySet(),Collections.emptySet(),"",30);
        long before=at("2026-10-21T23:45:00-05:00");equal(ReminderTime.next(midnight,before-1000,lima),before);
        if(!ReminderTime.occurrenceDay(midnight,before,lima).equals("2026-10-22"))throw new AssertionError("Wrong routine date for advance reminder");
        Set<Integer> daily=new HashSet<>(Arrays.asList(0,1,2,3,4,5,6));
        ReminderTime.Plan spring=plan("2026-03-07","14:00",daily,Collections.emptySet(),"",0);
        long saturday=at("2026-03-07T14:00:00-05:00"),sunday=at("2026-03-08T14:00:00-04:00");equal(ReminderTime.next(spring,saturday,ny),sunday);equal(sunday-saturday,23*3600000L);
        ReminderTime.Plan fall=plan("2026-10-31","14:00",daily,Collections.emptySet(),"",0);
        equal(ReminderTime.next(fall,at("2026-10-31T14:00:00-04:00"),ny),at("2026-11-01T14:00:00-05:00"));
        boolean rejected=false;try{plan("2026-02-30","14:00",daily,Collections.emptySet(),"",0);}catch(IllegalArgumentException e){rejected=true;}if(!rejected)throw new AssertionError("Invalid civil date accepted");
        System.out.println("Native civil-time tests passed: local 14:00, weekly repetition, future start, skipped dates, archive cutoff, one-shot, midnight offset, 23/25-hour DST days and validation.");
    }
}
