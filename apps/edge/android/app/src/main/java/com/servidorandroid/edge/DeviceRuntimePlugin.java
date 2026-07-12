package com.servidorandroid.edge;

import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceRuntime")
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
