import Adw from 'gi://Adw';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {buildPrefsWidget} from './common/pref.js';

export default class TouchpadGestureCustomizationPreferences extends ExtensionPreferences {
    fillPreferencesWindow(prefsWindow: Adw.PreferencesWindow) {
        const UIDirPath = this.metadata.dir.get_child('ui').get_path() ?? '';
        const settings = this.getSettings();
        buildPrefsWidget(prefsWindow, settings, UIDirPath);
        return Promise.resolve();
    }
}
