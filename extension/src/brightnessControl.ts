import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {loadInterfaceXML} from 'resource:///org/gnome/shell/misc/fileUtils.js';
import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {createSwipeTracker} from './swipeTracker.js';
import {ExtSettings, TouchpadConstants} from '../constants.js';

export class BrightnessControlGestureExtension implements ISubExtension {
    private _verticalSwipeTracker?: SwipeTracker;
    private _horizontalSwipeTracker?: SwipeTracker;
    private _verticalConnectHandlers?: number[];
    private _horizontalConnectHandlers?: number[];
    private _brightnessProxy?: Gio.DBusProxy;
    private _lastOsdShowTimestamp: number = 0;

    apply() {
        const iface = loadInterfaceXML('org.gnome.SettingsDaemon.Power.Screen');

        if (iface === null) {
            console.error('D-Bus interface for brightness is missing');

            this._brightnessProxy = undefined;
            return;
        }

        const BrightnessProxy = Gio.DBusProxy.makeProxyWrapper(
            iface
        ) as unknown as new (
            connection: Gio.DBusConnection,
            name: string | null,
            objectPath: string,
            callback?: (proxy: Gio.DBusProxy, error: Error | null) => void
        ) => Gio.DBusProxy;

        this._brightnessProxy = new BrightnessProxy(
            Gio.DBus.session,
            'org.gnome.SettingsDaemon.Power',
            '/org/gnome/SettingsDaemon/Power',
            (proxy, error) => {
                if (error)
                    console.error(
                        `Failed to connect to the ${proxy.g_interface_name} D-Bus interface`,
                        error
                    );
            }
        );
    }

    destroy(): void {
        delete this._brightnessProxy;

        this._verticalConnectHandlers?.forEach(handle =>
            this._verticalSwipeTracker?.disconnect(handle)
        );
        this._verticalConnectHandlers = undefined;
        this._verticalSwipeTracker?.destroy();

        this._horizontalConnectHandlers?.forEach(handle =>
            this._horizontalSwipeTracker?.disconnect(handle)
        );
        this._horizontalConnectHandlers = undefined;
        this._horizontalSwipeTracker?.destroy();
    }

    setVerticalSwipeTracker(nfingers: number[]) {
        this._verticalSwipeTracker = createSwipeTracker(
            global.stage,
            nfingers,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            Clutter.Orientation.VERTICAL,
            !ExtSettings.INVERT_BRIGHTNESS_DIRECTION,
            TouchpadConstants.BRIGHTNESS_CONTROL_MULTIPLIER * 100,
            {allowTouch: false}
        );

        this._verticalConnectHandlers = [
            this._verticalSwipeTracker.connect(
                'begin',
                this._gestureBegin.bind(this)
            ),
            this._verticalSwipeTracker.connect(
                'update',
                this._gestureUpdate.bind(this)
            ),
            this._verticalSwipeTracker.connect(
                'end',
                this._gestureEnd.bind(this)
            ),
        ];
    }

    setHorizontalSwipeTracker(nfingers: number[]) {
        this._horizontalSwipeTracker = createSwipeTracker(
            global.stage,
            nfingers,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            Clutter.Orientation.HORIZONTAL,
            !ExtSettings.INVERT_BRIGHTNESS_DIRECTION,
            TouchpadConstants.BRIGHTNESS_CONTROL_MULTIPLIER * 100,
            {allowTouch: false}
        );

        this._horizontalConnectHandlers = [
            this._horizontalSwipeTracker.connect(
                'begin',
                this._gestureBegin.bind(this)
            ),
            this._horizontalSwipeTracker.connect(
                'update',
                this._gestureUpdate.bind(this)
            ),
            this._horizontalSwipeTracker.connect(
                'end',
                this._gestureEnd.bind(this)
            ),
        ];
    }

    get _brightness() {
        return this._brightnessProxy?.Brightness ?? 0;
    }

    set _brightness(value: number) {
        if (
            this._brightnessProxy === undefined ||
            this._brightnessProxy.Brightness === null
        ) {
            return;
        }

        this._brightnessProxy.Brightness = value;
    }

    _showOsd(brightness: number) {
        // If osd is updated too frequently, it may lag or freeze, so cap it to 30 fps
        const nowTimestamp = new Date().getTime();

        if (nowTimestamp - this._lastOsdShowTimestamp < 1000 / 30) {
            return;
        }

        this._lastOsdShowTimestamp = nowTimestamp;

        const percentage = brightness / 100;

        const monitor = -1; // Display volume window on all monitors
        const icon = Gio.Icon.new_for_string('display-brightness-symbolic');

        Main.osdWindowManager.show(monitor, icon, null, percentage);
    }

    _gestureBegin(_tracker: SwipeTracker): void {
        _tracker.confirmSwipe(
            global.screen_height,
            [0, 100], // no snapping is needed as brightness change is continuous, but this will automatically clamp progress to [0, 100]
            this._brightness, // current brightness
            0 // can be whatever
        );
    }

    _gestureUpdate(_tracker: SwipeTracker, progress: number): void {
        // Round instead of truncating so that brightness changes sync exactly with extensions like "OSD Volume Number"
        const brightness = Math.round(progress);
        this._brightness = brightness;
        this._showOsd(brightness);
    }

    _gestureEnd(
        _tracker: SwipeTracker,
        duration: number,
        progress: number
    ): void {}
}
