"""Verify the installed preview identity before distributing an Android update."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parent.parent
CHANNEL = json.loads((ROOT / '.github/life-preview-channel.json').read_text())


def sdk_tool(name):
    sdk = os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT')
    if not sdk:
        raise ValueError('Set ANDROID_HOME to the Android SDK.')
    return str(Path(sdk) / 'build-tools/35.0.0' / name)


def apk_version(apk):
    badging = subprocess.check_output([sdk_tool('aapt2'), 'dump', 'badging', str(apk)], text=True)
    match = re.search(r"^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", badging, re.M)
    if not match:
        raise ValueError('Cannot read the APK identity and version.')
    return {'applicationId': match[1], 'versionCode': int(match[2]), 'version': match[3]}


def verify_identity(apk):
    identity = apk_version(apk)
    if identity['applicationId'] != CHANNEL['applicationId']:
        raise ValueError('Wrong application ID: this would install as a different app.')
    signature = subprocess.check_output([sdk_tool('apksigner'), 'verify', '--print-certs', str(apk)], text=True, stderr=subprocess.PIPE)
    certificates = re.findall(r'^Signer #\d+ certificate SHA-256 digest: ([a-f0-9]+)$', signature, re.M)
    if certificates != [CHANNEL['certificateSha256']]:
        raise ValueError('Wrong signing certificate: this APK cannot update the installed preview.')
    if identity['versionCode'] < CHANNEL['minimumVersionCode']:
        raise ValueError('APK predates the installed preview baseline.')
    return {**identity, 'certificateSha256': certificates[0]}


def verify_update(apk, previous):
    identity = verify_identity(apk)
    installed = verify_identity(previous)
    if identity['versionCode'] <= installed['versionCode']:
        raise ValueError('An update must have a higher versionCode than the previous delivered APK.')
    return identity


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk', type=Path)
    parser.add_argument('--previous', type=Path)
    args = parser.parse_args()
    try:
        result = verify_update(args.apk, args.previous) if args.previous else verify_identity(args.apk)
        print(json.dumps(result, indent=2))
    except (ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'Update identity check failed: {error}\n')
