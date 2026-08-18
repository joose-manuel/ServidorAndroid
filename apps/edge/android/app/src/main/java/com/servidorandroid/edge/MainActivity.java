package com.servidorandroid.edge;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // @deprecated EdgeTunnelPlugin is legacy: no Ionic/TS code invokes
        // EdgeTunnel.start()/stop()/status(). The remote access path goes
        // through the Fly.io API. Keep registered until the tunnel decision
        // (see cleanup/dead-code plan) is resolved.
        registerPlugin(EdgeTunnelPlugin.class);
        registerPlugin(DeviceRuntimePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
