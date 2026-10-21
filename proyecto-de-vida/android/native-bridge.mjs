// SPDX-License-Identifier: AGPL-3.0-only
import { registerPlugin } from '@capacitor/core';

const backup = registerPlugin('LifeBackup');
window.proyectoAndroid = Object.freeze({ saveBackup: options => backup.save(options) });
