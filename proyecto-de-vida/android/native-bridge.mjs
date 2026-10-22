// SPDX-License-Identifier: AGPL-3.0-only
import { registerPlugin } from '@capacitor/core';

const backup = registerPlugin('LifeBackup');
const reminders = registerPlugin('LifeReminders');
window.proyectoAndroid = Object.freeze({ saveBackup: options => backup.save(options), reminders: Object.freeze({status:()=>reminders.status(),sync:options=>reminders.sync(options),requestNotifications:()=>reminders.requestNotifications(),openExactSettings:()=>reminders.openExactSettings(),openNotificationSettings:()=>reminders.openNotificationSettings()}) });
