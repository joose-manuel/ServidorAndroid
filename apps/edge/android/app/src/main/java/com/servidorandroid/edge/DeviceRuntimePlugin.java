package com.servidorandroid.edge;

import android.Manifest;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(
    name = "DeviceRuntime",
    permissions = {
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }),
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class DeviceRuntimePlugin extends Plugin {

    @PluginMethod
    public void getInfo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("manufacturer", Build.MANUFACTURER);
        result.put("model", Build.MODEL);
        result.put("deviceName", buildDeviceName());

        Double temperatureC = readBatteryTemperature();
        if (temperatureC != null) {
            result.put("temperatureC", temperatureC);
        } else {
            result.put("temperatureC", JSObject.NULL);
        }

        call.resolve(result);
    }

    @PluginMethod
    public void ensureCameraPermission(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        requestPermissionForAlias("camera", call, "cameraPermissionCallback");
    }

    @PluginMethod
    public void ensureMicrophonePermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
    }

    @PermissionCallback
    private void cameraPermissionCallback(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        call.reject("camera permission not granted");
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        call.reject("microphone permission not granted");
    }

    private String buildDeviceName() {
        String manufacturer = safe(Build.MANUFACTURER);
        String model = safe(Build.MODEL);
        if (model.toLowerCase().startsWith(manufacturer.toLowerCase())) {
            return model;
        }
        return (manufacturer + " " + model).trim();
    }

    private Double readBatteryTemperature() {
        IntentFilter filter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
        Intent batteryStatus = getContext().registerReceiver(null, filter);
        if (batteryStatus == null) {
            return null;
        }

        int temperatureTenths = batteryStatus.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Integer.MIN_VALUE);
        if (temperatureTenths == Integer.MIN_VALUE) {
            return null;
        }

        return temperatureTenths / 10.0;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
