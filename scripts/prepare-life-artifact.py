"""Verify that the downloadable signed preview matches the current app sources."""
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
version = json.loads((root / 'proyecto-de-vida/android/version.json').read_text())
filename = f"proyecto-de-vida-{version['name']}-prueba.apk"
apk = root / 'downloads' / filename
metadata = json.loads(apk.with_suffix('.json').read_text())
tools = pathlib.Path(os.environ['ANDROID_HOME']) / 'build-tools/35.0.0'
assert metadata['version'] == version['name']
assert metadata['versionCode'] == version['code']
assert metadata['applicationId'] == 'com.proyectodevida.app.preview'
assert hashlib.sha256(apk.read_bytes()).hexdigest() == metadata['sha256']
assert re.fullmatch(r'[a-f0-9]{40}', metadata['sourceCommit'])
signature = subprocess.check_output([str(tools / 'apksigner'), 'verify', '--print-certs', str(apk)], text=True)
assert f"Signer #1 certificate SHA-256 digest: {metadata['certificateSha256']}" in signature
badging = subprocess.check_output([str(tools / 'aapt2'), 'dump', 'badging', str(apk)], text=True)
assert "package: name='com.proyectodevida.app.preview'" in badging
assert f"versionName='{version['name']}'" in badging
assert f"versionCode='{version['code']}'" in badging

source = metadata['sourceCommit']
if subprocess.run(['git', 'cat-file', '-e', source + '^{commit}'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
    subprocess.run(['git', 'fetch', '--no-tags', '--depth=1', 'origin', source], cwd=root, check=True)
# Documentation and tests may change without repackaging; app and native code may not.
subprocess.run([
    'git', 'diff', '--exit-code', '--no-ext-diff', source, 'HEAD', '--',
    'proyecto-de-vida', 'scripts/build-life-android.mjs', 'scripts/configure-life-preview.mjs',
    ':(exclude,glob)proyecto-de-vida/**/*.md',
    ':(exclude,glob)proyecto-de-vida/tests/**',
    ':(exclude,glob)proyecto-de-vida/android/tests/**',
], cwd=root, check=True)
www = root / '.cache/life-android/www'
with zipfile.ZipFile(apk) as package:
    info = json.loads(package.read('assets/public/build-info.json'))
    assert info['sourceCommit'] == source
    assert info['version'] == version['name'] and info['versionCode'] == version['code']
    assert info['distribution'] == 'preview'
    for path in www.rglob('*'):
        if path.is_file() and path.name != 'build-info.json':
            relative = path.relative_to(www).as_posix()
            assert package.read('assets/public/' + relative) == path.read_bytes(), relative

out = root / '.cache/life-artifact'
out.mkdir(parents=True, exist_ok=True)
shutil.copyfile(apk, out / filename)
shutil.copyfile(apk.with_name(filename + '.sha256'), out / (filename + '.sha256'))
(out / 'version.json').write_text(json.dumps(metadata, indent=2) + '\n')
(out / 'LEEME.txt').write_text('Proyecto de vida actualizado de prueba. Se instala aparte. No desinstales la original. Para copiar tus registros: exporta un respaldo en la original e impórtalo en la prueba.\n')
if os.environ.get('GITHUB_OUTPUT'):
    with open(os.environ['GITHUB_OUTPUT'], 'a') as stream:
        stream.write(f"name=proyecto-de-vida-{version['name']}-prueba\n")
print(f"Verified {filename}: current app sources, version, signature and SHA-256 match the direct download.")
