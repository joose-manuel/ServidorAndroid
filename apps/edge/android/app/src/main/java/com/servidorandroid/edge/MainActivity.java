package com.servidorandroid.edge;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EdgeTunnelPlugin.class);
        registerPlugin(DeviceRuntimePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
