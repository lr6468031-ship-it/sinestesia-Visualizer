// SPDX-License-Identifier: AGPL-3.0-only
// Configure only the generated Android project; the installed production app is separate.
import {readFile, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const project=join(root,'.cache/life-android');
const android=join(project,'android');
const appId='com.proyectodevida.app.preview';
const version=JSON.parse(await readFile(join(root,'proyecto-de-vida/android/version.json'),'utf8'));
const label=`Proyecto de vida ${version.name} · Prueba`;
const gradlePath=join(android,'app/build.gradle');
const gradle=await readFile(gradlePath,'utf8');
if(!gradle.includes('applicationId "com.proyectodevida.app"')&&!gradle.includes(`applicationId "${appId}"`))throw Error('Unexpected generated application ID');
await writeFile(gradlePath,gradle.replace(/applicationId "com\.proyectodevida\.app(?:\.preview)?"/,`applicationId "${appId}"`));

// Preserve the Java namespace, and make every app component name explicit.
const manifestPath=join(android,'app/src/main/AndroidManifest.xml');
const manifest=await readFile(manifestPath,'utf8');
await writeFile(manifestPath,manifest.replaceAll('android:name=".MainActivity"','android:name="com.proyectodevida.app.MainActivity"').replaceAll('android:name=".LifeReminderReceiver"','android:name="com.proyectodevida.app.LifeReminderReceiver"'));
const stringsPath=join(android,'app/src/main/res/values/strings.xml');
let strings=await readFile(stringsPath,'utf8');
for(const key of ['app_name','title_activity_main'])strings=strings.replace(new RegExp(`(<string name="${key}">)[^<]*(</string>)`),`$1${label}$2`);
for(const key of ['package_name','custom_url_scheme'])strings=strings.replace(new RegExp(`(<string name="${key}">)[^<]*(</string>)`),`$1${appId}$2`);
await writeFile(stringsPath,strings);

for(const path of [join(project,'capacitor.config.json'),join(android,'app/src/main/assets/capacitor.config.json')]){
 const config=JSON.parse(await readFile(path,'utf8'));config.appId=appId;config.appName=label;
 await writeFile(path,JSON.stringify(config,null,2)+'\n');
}
for(const path of [join(project,'www/build-info.json'),join(android,'app/src/main/assets/public/build-info.json')]){
 const info=JSON.parse(await readFile(path,'utf8'));Object.assign(info,{distribution:'preview',applicationId:appId});
 await writeFile(path,JSON.stringify(info,null,2)+'\n');
}
console.log(`${label}: ${appId}. Installs separately from the original app.`);
