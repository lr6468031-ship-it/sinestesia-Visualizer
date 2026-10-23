"""Sign future preview updates with the key that signed the installed 1.1.3 APK."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

from life_preview_identity import CHANNEL, ROOT, apk_version, sdk_tool, verify_identity, verify_update


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-key', action='store_true')
    parser.add_argument('--input', type=Path, default=ROOT / '.cache/life-android/android/app/build/outputs/apk/release/app-release-unsigned.apk')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--previous', type=Path, default=ROOT / CHANNEL['latestApk'])
    args = parser.parse_args()
    private = ROOT.parent / 'proyecto-de-vida-preview-private-signing'
    keystore = Path(os.environ.get('LIFE_PREVIEW_KEYSTORE', private / 'preview.p12'))
    password = Path(os.environ.get('LIFE_PREVIEW_STOREPASS_FILE', private / 'storepass'))
    keypass = Path(os.environ.get('LIFE_PREVIEW_KEYPASS_FILE', password))
    alias = os.environ.get('LIFE_PREVIEW_KEY_ALIAS', 'proyecto-de-vida-preview')
    if not all(path.is_file() for path in [keystore, password, keypass]):
        raise ValueError('Restore the existing private preview key and password files. Do not generate a replacement key.')
    keytool = str(Path(os.environ['JAVA_HOME']) / 'bin/keytool') if os.environ.get('JAVA_HOME') else 'keytool'
    certificate = subprocess.check_output([keytool, '-exportcert', '-keystore', str(keystore), '-alias', alias, '-storepass:file', str(password)], stderr=subprocess.PIPE)
    if hashlib.sha256(certificate).hexdigest() != CHANNEL['certificateSha256']:
        raise ValueError('The private key does not match the installed application. Signing stopped.')
    if args.check_key:
        print('Signing key matches the installed Proyecto de vida preview certificate.')
        return

    previous = verify_identity(args.previous)
    version = json.loads((ROOT / 'proyecto-de-vida/android/version.json').read_text())
    if version['code'] <= previous['versionCode']:
        raise ValueError('Increase android/version.json code above the previous delivered APK before signing an update.')
    expected = {'applicationId': CHANNEL['applicationId'], 'versionCode': version['code'], 'version': version['name']}
    if apk_version(args.input) != expected:
        raise ValueError('The generated APK package/version does not match the update channel and version.json.')
    with zipfile.ZipFile(args.input) as package:
        info = json.loads(package.read('assets/public/build-info.json'))
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    if (info.get('sourceCommit'), info.get('version'), info.get('versionCode'), info.get('applicationId'), info.get('distribution')) != (commit, version['name'], version['code'], CHANNEL['applicationId'], 'preview'):
        raise ValueError('Regenerate and compile the preview from the current committed source before signing.')
    subprocess.run(['git', 'diff', '--exit-code', 'HEAD', '--', 'proyecto-de-vida', 'scripts/build-life-android.mjs', 'scripts/configure-life-preview.mjs'], cwd=ROOT, check=True, stdout=subprocess.PIPE)
    output = args.output or ROOT / f".cache/life-signed/proyecto-de-vida-{version['name']}-prueba.apk"
    if output.suffix != '.apk' or output.exists() or output.with_suffix('.json').exists():
        raise ValueError('Choose a new APK output path; existing delivered files must not be overwritten.')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='life-sign-') as temp:
        aligned = Path(temp) / 'aligned.apk'
        signed = Path(temp) / 'signed.apk'
        subprocess.run([sdk_tool('zipalign'), '-P', '16', '-f', '4', str(args.input), str(aligned)], check=True)
        command = [sdk_tool('apksigner'), 'sign', '--ks', str(keystore), '--ks-key-alias', alias, '--ks-pass', f'file:{password}']
        # apksigner consumes successive lines when the same password file is
        # supplied twice. Omit key-pass when it is the store password.
        if keypass.resolve() != password.resolve():
            command += ['--key-pass', f'file:{keypass}']
        subprocess.run(command + ['--out', str(signed), str(aligned)], check=True)
        identity = verify_update(signed, args.previous)
        shutil.copyfile(signed, output)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    metadata = {**identity, 'sourceCommit': commit, 'distribution': 'preview', 'file': output.name, 'sizeBytes': output.stat().st_size, 'sha256': digest}
    output.with_suffix('.json').write_text(json.dumps(metadata, indent=2) + '\n')
    output.with_name(output.name + '.sha256').write_text(f'{digest}  {output.name}\n')
    print(f'Signed and verified update: {output}')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f'Preview signing stopped: {error}')
