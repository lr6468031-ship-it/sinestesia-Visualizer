// SPDX-License-Identifier: AGPL-3.0-only
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'proyecto-de-vida');
const native = join(source, 'android');
const project = join(root, '.cache/life-android');
const www = join(project, 'www');
const android = join(project, 'android');
const version = JSON.parse(await readFile(join(native, 'version.json'), 'utf8'));
await mkdir(project, { recursive: true });
await rm(www, { recursive: true, force: true });
await mkdir(www);
const { dependencies } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
await writeFile(join(project, 'package.json'), JSON.stringify({ name: 'proyecto-de-vida-android', version: version.name, private: true, dependencies }, null, 2));
await cp(join(native, 'capacitor.config.json'), join(project, 'capacitor.config.json'));
// Ship this app alone, including its own media, adapted modules and licenses.
for (const file of ['index.html', 'app.mjs', 'core.mjs', 'life-flame.mjs', 'styles.css', 'flame-theme.css', 'planning.css','planning.mjs','reminders.mjs','icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'LICENSE', 'THIRD_PARTY.md', 'assets', 'vendor']) {
  await cp(join(source, file), join(www, file), { recursive: true });
}
await build({ entryPoints: [join(native, 'native-bridge.mjs')], bundle: true, format: 'iife', platform: 'browser', target: 'chrome105', minify: true, outfile: join(www, 'native-bridge.js') });
const html = await readFile(join(www, 'index.html'), 'utf8');
await writeFile(join(www, 'index.html'), html.replace('<script type="module" src="app.mjs">', '<script src="native-bridge.js"></script><script type="module" src="app.mjs">').replaceAll('este navegador', 'este dispositivo'));
const app = (await readFile(join(www, 'app.mjs'), 'utf8')).replaceAll('este navegador', 'este dispositivo').replace('Esta versión funciona en tu navegador y puede usarse sin conexión después de la primera carga.', 'Esta versión para Android incluye todos sus archivos y funciona sin conexión desde el primer inicio.');
await writeFile(join(www, 'app.mjs'), app);
await writeFile(join(www, 'build-info.json'), JSON.stringify({ version: version.name, versionCode: version.code, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() }, null, 2));
const cap = (...args) => execFileSync(process.execPath, [join(root, 'node_modules/@capacitor/cli/bin/capacitor'), ...args], { cwd: project, stdio: 'inherit' });
if (!existsSync(android)) cap('add', 'android');
cap('sync', 'android');
const java = join(android, 'app/src/main/java/com/proyectodevida/app');
await mkdir(java, { recursive: true });
for (const file of ['MainActivity.java', 'LifeBackupPlugin.java', 'ReminderTime.java', 'LifeReminderScheduler.java', 'LifeReminderReceiver.java', 'LifeRemindersPlugin.java']) await cp(join(native, file), join(java, file));
const testJava = join(android, 'app/src/test/java/com/proyectodevida/app');
await mkdir(testJava, { recursive: true });
await cp(join(native, 'tests/LifeReminderSchedulerTest.java'), join(testJava, 'LifeReminderSchedulerTest.java'));
await cp(join(native, 'testing.gradle'), join(android, 'app/life-testing.gradle'));
const res = join(android, 'app/src/main/res');
const manifestPath = join(android, 'app/src/main/AndroidManifest.xml');
const manifest = await readFile(manifestPath, 'utf8');
const baseManifest = manifest.replace(/<!-- Life reminders start -->[\s\S]*?<!-- Life reminders end -->/g, '');
const reminderPermissions = '<!-- Life reminders start --><uses-permission android:name="android.permission.POST_NOTIFICATIONS"/><uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/><uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/><uses-permission android:name="android.permission.VIBRATE"/><!-- Life reminders end -->';
const reminderReceiver = '<!-- Life reminders start --><receiver android:name=".LifeReminderReceiver" android:exported="false"><intent-filter><action android:name="android.intent.action.BOOT_COMPLETED"/><action android:name="android.intent.action.MY_PACKAGE_REPLACED"/><action android:name="android.intent.action.TIME_SET"/><action android:name="android.intent.action.TIMEZONE_CHANGED"/><action android:name="android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED"/></intent-filter></receiver><!-- Life reminders end -->';
const secureManifest = baseManifest.replace('<application', reminderPermissions+'<application').replace('</application>', reminderReceiver+'</application>').replace('android:allowBackup="true"', 'android:allowBackup="false"');
await writeFile(manifestPath, secureManifest.includes('android:usesCleartextTraffic=') ? secureManifest : secureManifest.replace('<application', '<application android:usesCleartextTraffic="false"'));
await cp(join(native, 'styles.xml'), join(res, 'values/styles.xml'));
await cp(join(native, 'life_logo.xml'), join(res, 'drawable/life_logo.xml'));
await cp(join(native, 'ic_life_notification.xml'), join(res, 'drawable/ic_life_notification.xml'));
// Both legacy and adaptive launchers use the app's own artwork.
for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) await cp(join(source, 'icon-192.png'), join(res, `mipmap-${density}`, name));
}
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) await writeFile(join(res, 'mipmap-anydpi-v26', name), '<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/life_background"/><foreground android:drawable="@drawable/life_logo"/></adaptive-icon>');
await writeFile(join(res, 'values/life-colors.xml'), '<?xml version="1.0" encoding="utf-8"?><resources><color name="life_background">#050a18</color></resources>');
const gradlePath = join(android, 'app/build.gradle');
const gradle = await readFile(gradlePath, 'utf8');
await writeFile(gradlePath, gradle.replace(/versionCode \d+/, `versionCode ${version.code}`).replace(/versionName "[^"]+"/, `versionName "${version.name}"`)+(gradle.includes("apply from: 'life-testing.gradle'")?'':"\napply from: 'life-testing.gradle'\n"));
console.log(`\nProyecto de vida ${version.name}: native project ready at ${android}`);
console.log('Build: cd .cache/life-android/android && ./gradlew assembleRelease');
