package com.servidorandroid.edge;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.text.TextUtils;
import android.util.Log;

import org.json.JSONObject;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URL;
import java.util.ArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "EdgeTunnel")
public class EdgeTunnelPlugin extends Plugin {

    private static final String TAG = "EdgeTunnel";
    private static final String ASSET_NAME = "cloudflared";
    private static final String NATIVE_LIB_NAME = "libcloudflared.so";
    private static final String URL_RE = "https://[a-z0-9-]+\\.trycloudflare\\.com";

    private final ArrayList<String> logs = new ArrayList<>();
    private Process process;
    private ExecutorService reader;
    private String currentUrl;
    private boolean running;
    private ApiServer apiServer;
    private boolean isEmulator;
    private String primaryDnsServer;  // Adaptive DNS: 8.8.8.8 for emulator, 1.1.1.1 for devices
    private String fallbackDnsServer; // Fallback DNS server

    @PluginMethod
    public void start(PluginCall call) {
        if (running) {
            JSObject ret = new JSObject();
            ret.put("url", currentUrl);
            ret.put("alreadyRunning", true);
            call.resolve(ret);
            return;
        }

        int port = call.getInt("port", 3000);
        String serviceUrl = call.getString("serviceUrl", "http://localhost:" + port);

        try {
            // Detect emulator and configure DNS accordingly
            detectEmulatorAndConfigureDns();
            
            // Start the local API server first.
            startApiServer(port);

            File binary = locateOrExtractBinary();
            log("starting tunnel: " + binary.getAbsolutePath() + " -> " + serviceUrl);
            log("Device info: isEmulator=" + isEmulator + ", primaryDns=" + primaryDnsServer);
            startProcess(binary, serviceUrl);

            JSObject ret = new JSObject();
            ret.put("binaryPath", binary.getAbsolutePath());
            ret.put("isEmulator", isEmulator);
            call.resolve(ret);
        } catch (Exception e) {
            log("start failed: " + e.getMessage());
            call.reject("No se pudo iniciar el tunnel: " + e.getMessage(), e);
        }
    }

    private void startApiServer(int port) {
        try {
            apiServer = new ApiServer(this, port);
            apiServer.start();
            log("API server started on port " + port);
        } catch (Exception e) {
            log("API server start failed: " + e.getMessage());
        }
    }

    private void stopApiServer() {
        if (apiServer != null) {
            apiServer.stop();
            apiServer = null;
        }
    }

    /**
     * Detects if running on an emulator and configures DNS accordingly.
     * Emulators (Pixel API 37.0, etc.) need Google DNS (8.8.8.8) instead of Cloudflare DNS.
     */
    private void detectEmulatorAndConfigureDns() {
        // Check multiple indicators of emulator
        String fingerprint = Build.FINGERPRINT.toLowerCase();
        String device = Build.DEVICE.toLowerCase();
        String hardware = Build.HARDWARE.toLowerCase();
        String model = Build.MODEL.toLowerCase();
        String product = Build.PRODUCT.toLowerCase();
        
        isEmulator = fingerprint.contains("generic") || 
                     device.contains("generic") || 
                     hardware.contains("ranchu") || 
                     hardware.contains("goldfish") ||
                     model.contains("emulator") ||
                     product.contains("sdk") ||
                     product.contains("generic");
        
        if (isEmulator) {
            // Use Google DNS for emulator (more reliable on Android emulator)
            primaryDnsServer = "8.8.8.8";
            fallbackDnsServer = "8.8.4.4";
            log("Emulator detected (fingerprint=" + fingerprint + "), using Google DNS: " + primaryDnsServer);
        } else {
            // Use Cloudflare DNS for real devices
            primaryDnsServer = "1.1.1.1";
            fallbackDnsServer = "8.8.8.8";
            log("Physical device detected, using Cloudflare DNS: " + primaryDnsServer);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (!running) {
            call.resolve();
            return;
        }
        try {
            running = false;
            currentUrl = null;
            if (process != null) {
                process.destroy();
                process = null;
            }
            if (reader != null && !reader.isShutdown()) {
                reader.shutdownNow();
            }
            stopApiServer();
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", running);
        ret.put("url", currentUrl);
        call.resolve(ret);
    }

    @PluginMethod
    public void getLogs(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("logs", TextUtils.join("\n", logs));
        call.resolve(ret);
    }

    void log(String msg) {
        Log.i(TAG, msg);
        logs.add(msg);
        if (logs.size() > 500) logs.remove(0);
    }

    private File locateOrExtractBinary() throws Exception {
        log("locateOrExtractBinary: starting");
        
        // Strategy 1: native library dir (read-only mount, always executable).
        File nativeLib = new File(getContext().getApplicationInfo().nativeLibraryDir, NATIVE_LIB_NAME);
        log("nativeLib path: " + nativeLib.getAbsolutePath() + " exists=" + nativeLib.exists() + " size=" + nativeLib.length());
        
        if (nativeLib.exists() && nativeLib.length() > 1_000_000) {
            if (verifyRuns(nativeLib)) {
                log("native lib works directly");
                return nativeLib;
            }
            log("native lib exists but won't run directly: " + nativeLib.getAbsolutePath());
            
            // Strategy 2: copy from native lib to filesDir with chmod via shell.
            File copy = new File(getContext().getFilesDir(), ASSET_NAME);
            log("copying native lib to filesDir: " + copy.getAbsolutePath());
            if (copyTo(nativeLib, copy)) {
                log("copy successful, canExecute=" + copy.canExecute());
                if (verifyRuns(copy)) {
                    log("copy works");
                    return copy;
                }
                log("copy doesn't work either");
            } else {
                log("copy failed");
            }
        }

        // Strategy 3: extract from assets (fallback).
        File fromAssets = new File(getContext().getFilesDir(), ASSET_NAME);
        log("trying assets fallback: " + fromAssets.getAbsolutePath());
        if (extractFromAssets(fromAssets)) {
            log("extract successful, canExecute=" + fromAssets.canExecute());
            if (verifyRuns(fromAssets)) {
                log("extracted binary works");
                return fromAssets;
            }
            log("extracted binary doesn't work");
        } else {
            log("extract failed");
        }

        throw new Exception("binary no ejecutable en ninguna ubicación probada");
    }

    private boolean copyTo(File src, File dst) throws Exception {
        log("copyTo: " + src.getAbsolutePath() + " -> " + dst.getAbsolutePath());
        if (dst.exists()) {
            dst.delete();
        }
        try (InputStream in = new java.io.FileInputStream(src);
             OutputStream out = new FileOutputStream(dst)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            long total = 0;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                total += n;
            }
            log("copied " + total + " bytes");
        }
        boolean result = setExecutable(dst);
        log("setExecutable result: " + result + " canExecute=" + dst.canExecute());
        return result;
    }

    private boolean extractFromAssets(File dst) throws Exception {
        if (dst.exists()) dst.delete();
        try (InputStream in = getContext().getAssets().open(ASSET_NAME);
             FileOutputStream out = new FileOutputStream(dst)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
        return setExecutable(dst);
    }

    private boolean setExecutable(File file) {
        log("setExecutable: " + file.getAbsolutePath());
        // Java API.
        boolean ok1 = file.setExecutable(true, false);
        boolean ok2 = file.setReadable(true, false);
        boolean ok3 = file.setWritable(false, false);
        log("Java API: setExecutable=" + ok1 + " setReadable=" + ok2 + " setWritable(readonly)=" + ok3);
        
        // Shell chmod (more reliable on some Android versions).
        try {
            Process p = Runtime.getRuntime().exec(new String[]{"/system/bin/chmod", "755", file.getAbsolutePath()});
            boolean finished = p.waitFor(2, TimeUnit.SECONDS);
            int exitCode = p.exitValue();
            p.destroy();
            log("chmod 755: finished=" + finished + " exitCode=" + exitCode);
        } catch (Exception e) {
            log("chmod failed: " + e.getMessage());
        }
        
        boolean canExec = file.canExecute();
        log("final canExecute=" + canExec);
        return canExec;
    }

    private boolean verifyRuns(File binary) {
        log("verifyRuns: " + binary.getAbsolutePath());
        try {
            ProcessBuilder pb = new ProcessBuilder(binary.getAbsolutePath(), "--version");
            pb.redirectErrorStream(true);
            Process p = pb.start();
            
            // Read output
            StringBuilder output = new StringBuilder();
            try (BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                String line;
                while ((line = br.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }
            
            boolean finished = p.waitFor(5, TimeUnit.SECONDS);
            int code = p.exitValue();
            p.destroy();
            
            log("verify " + binary.getAbsolutePath() + " finished=" + finished + " code=" + code + " output=" + output.toString().trim());
            return finished && code == 0;
        } catch (Exception e) {
            log("verify failed for " + binary.getAbsolutePath() + ": " + e.getMessage());
            return false;
        }
    }

    private Network findPhysicalNetwork() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext()
                    .getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return null;
            for (Network n : cm.getAllNetworks()) {
                NetworkCapabilities caps = cm.getNetworkCapabilities(n);
                if (caps == null) continue;
                if (caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) continue;
                if (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
                    return n;
                }
            }
        } catch (Exception e) {
            log("findPhysicalNetwork error: " + e.getMessage());
        }
        return null;
    }

    private void tryFixSystemDns() {
        log("tryFixSystemDns: attempting to fix system DNS... (using " + primaryDnsServer + ")");
        String[][] cmds = {
            {"/system/bin/setprop", "net.dns1", primaryDnsServer},
            {"/system/bin/setprop", "net.dns2", fallbackDnsServer},
            {"settings", "put", "global", "private_dns_mode", "hostname"},
            {"settings", "put", "global", "private_dns_specifier", "dns.google"},
        };
        for (String[] cmd : cmds) {
            try {
                Process p = Runtime.getRuntime().exec(cmd);
                boolean ok = p.waitFor(3, TimeUnit.SECONDS);
                int code = p.exitValue();
                p.destroy();
                log("cmd " + cmd[0] + " " + cmd[1] + " -> finished=" + ok + " exit=" + code);
            } catch (Exception e) {
                log("cmd " + cmd[0] + " " + cmd[1] + " failed: " + e.getMessage());
            }
        }
        // Try su-based DNS fixes (works on some emulators/rooted devices)
        String[][] suCmds = {
            {"su", "-c", "echo 'nameserver " + primaryDnsServer + "' > /data/local/tmp/resolv.conf && mount --bind /data/local/tmp/resolv.conf /etc/resolv.conf"},
            {"su", "-c", "iptables -t nat -F OUTPUT"},
            {"su", "-c", "iptables -t nat -A OUTPUT -p udp --dport 53 -j DNAT --to-destination " + primaryDnsServer + ":53"},
            {"su", "-c", "iptables -t nat -A OUTPUT -p tcp --dport 53 -j DNAT --to-destination " + primaryDnsServer + ":53"},
            {"su", "0", "iptables", "-t", "nat", "-A", "OUTPUT", "-p", "udp", "--dport", "53", "-j", "DNAT", "--to-destination", primaryDnsServer + ":53"},
        };
        for (String[] cmd : suCmds) {
            try {
                Process p = Runtime.getRuntime().exec(cmd);
                boolean ok = p.waitFor(3, TimeUnit.SECONDS);
                int code = p.exitValue();
                p.destroy();
                log("su cmd " + cmd[0] + " -> exit=" + code);
            } catch (Exception e) {
                log("su cmd " + cmd[0] + " failed: " + e.getMessage());
            }
        }
    }

    private void runCloudflaredLoop(File binary, String serviceUrl) {
        reader = Executors.newSingleThreadExecutor();
        reader.execute(() -> {
            int retries = 0;
            while (running && retries < 100) {
                retries++;
                try {
                    log("runCloudflaredLoop attempt " + retries);
                    // Use Quick Tunnel mode (no credentials needed)
                    // Force Go DNS resolver with explicit IPv4 DNS servers
                    ProcessBuilder pb = new ProcessBuilder(
                            binary.getAbsolutePath(),
                            "tunnel",
                            "--no-autoupdate",
                            "--protocol", "quic",
                            "--url", serviceUrl
                    );
                    // Set multiple DNS environment variables to ensure cloudflared uses IPv4 DNS
                    pb.environment().put("TUNNEL_DNS_RESOLVER_ADDRS", primaryDnsServer + ":53");
                    pb.environment().put("TUNNEL_DNS_SERVERS", primaryDnsServer);
                    // Force Go DNS resolver and disable IPv6 to avoid [::1]:52 emulator DNS
                    pb.environment().put("GODEBUG", "netdns=go");
                    // Point Go DNS resolver to custom resolv.conf if it exists
                    File resolvFile = new File(getContext().getFilesDir(), "resolv.conf");
                    if (resolvFile.exists()) {
                        pb.environment().put("RESOLV_CONF", resolvFile.getAbsolutePath());
                    }
                    pb.redirectErrorStream(true);
                    process = pb.start();

                    try (BufferedReader br = new BufferedReader(
                            new InputStreamReader(process.getInputStream()))) {
                        String line;
                        while ((line = br.readLine()) != null) {
                            log(line);
                            // Extract tunnel URL from Quick Tunnel output
                            if (line.contains("https://") && line.contains("trycloudflare.com")) {
                                String url = extractUrl(line);
                                if (url != null && !url.equals(currentUrl)) {
                                    currentUrl = url;
                                    log("tunnel URL extracted: " + currentUrl);
                                    if (apiServer != null) apiServer.setTunnelUrl(currentUrl);
                                    notifyUrl(currentUrl);
                                }
                            }
                        }
                    }

                    boolean exited = process.waitFor(5, TimeUnit.SECONDS);
                    int code = exited ? process.exitValue() : -1;
                    process.destroy();
                    process = null;
                    log("cloudflared exited with code " + code + ", restarting in 5s...");
                    Thread.sleep(5000);
                } catch (InterruptedException ie) {
                    log("runCloudflaredLoop interrupted, stopping");
                    break;
                } catch (Exception e) {
                    log("runCloudflaredLoop error: " + e.getMessage());
                    break;
                }
            }
            running = false;
            currentUrl = null;
            notifyStopped();
            log("runCloudflaredLoop stopped after " + retries + " attempts");
        });
    }

    private void runCloudflaredLoopWithCredentials(File binary, File credFile, String serviceUrl, String tunnelId) {
        reader = Executors.newSingleThreadExecutor();
        reader.execute(() -> {
            int retries = 0;
            while (running && retries < 100) {
                retries++;
                try {
                    log("runCloudflaredLoopWithCredentials attempt " + retries);
                    // Use credentials-based tunnel with QUIC protocol (UDP-based, avoids SRV record lookups)
                    ProcessBuilder pb = new ProcessBuilder(
                            binary.getAbsolutePath(),
                            "--config", new File(getContext().getFilesDir(), ".cloudflared/config.yml").getAbsolutePath(),
                            "tunnel",
                            "--no-autoupdate",
                            "--protocol", "quic",
                            "run",
                            "--cred-file", credFile.getAbsolutePath(),
                            "--url", serviceUrl,
                            tunnelId
                    );
                    // Set environment variables for DNS configuration
                    pb.environment().put("TUNNEL_DNS_RESOLVER_ADDRS", primaryDnsServer + ":53");
                    pb.environment().put("TUNNEL_DNS_SERVERS", primaryDnsServer);
                    pb.environment().put("GODEBUG", "netdns=go");
                    // Point Go DNS resolver to custom resolv.conf if it exists
                    File resolvFile = new File(getContext().getFilesDir(), "resolv.conf");
                    if (resolvFile.exists()) {
                        pb.environment().put("RESOLV_CONF", resolvFile.getAbsolutePath());
                    }
                    pb.redirectErrorStream(true);
                    process = pb.start();

                    try (BufferedReader br = new BufferedReader(
                            new InputStreamReader(process.getInputStream()))) {
                        String line;
                        while ((line = br.readLine()) != null) {
                            log(line);
                            // Extract tunnel URL from logs
                            if (line.contains("https://") && line.contains("trycloudflare.com") && !line.contains("error") && !line.contains("failed")) {
                                String url = extractUrl(line);
                                if (url != null && !url.equals(currentUrl)) {
                                    currentUrl = url;
                                    log("tunnel URL extracted: " + currentUrl);
                                    if (apiServer != null) apiServer.setTunnelUrl(currentUrl);
                                    notifyUrl(currentUrl);
                                }
                            }
                        }
                    }

                    boolean exited = process.waitFor(5, TimeUnit.SECONDS);
                    int code = exited ? process.exitValue() : -1;
                    process.destroy();
                    process = null;
                    log("cloudflared exited with code " + code + ", restarting in 5s...");
                    Thread.sleep(5000);
                } catch (InterruptedException ie) {
                    log("runCloudflaredLoopWithCredentials interrupted, stopping");
                    break;
                } catch (Exception e) {
                    log("runCloudflaredLoopWithCredentials error: " + e.getMessage());
                    break;
                }
            }
            running = false;
            currentUrl = null;
            notifyStopped();
            log("runCloudflaredLoopWithCredentials stopped after " + retries + " attempts");
        });
    }

    private void tryRunWithCredentials(File binary, JSONObject result, String serviceUrl) {
        try {
            String tunnelId = result.getString("id");
            String accountTag = result.getString("account_tag");
            String secret = result.getString("secret");

            // Try to fix system DNS before starting cloudflared.
            tryFixSystemDns();

            // Write credentials file.
            JSONObject creds = new JSONObject();
            creds.put("AccountTag", accountTag);
            creds.put("TunnelSecret", secret);
            creds.put("TunnelID", tunnelId);
            File credFile = new File(getContext().getFilesDir(), "tunnel-creds.json");
            try (FileOutputStream fos = new FileOutputStream(credFile)) {
                fos.write(creds.toString().getBytes("UTF-8"));
            }
            log("credentials saved to " + credFile.getAbsolutePath());

            // Create cloudflared config file with explicit DNS settings
            createCloudflaredConfig();

            running = true;
            runCloudflaredLoopWithCredentials(binary, credFile, serviceUrl, tunnelId);

            log("cloudflared tunnel run started with id=" + tunnelId);
        } catch (Exception e) {
            log("tryRunWithCredentials failed: " + e.getMessage());
        }
    }

    private void createCloudflaredConfig() {
        try {
            File cloudflaredDir = new File(getContext().getFilesDir(), ".cloudflared");
            cloudflaredDir.mkdirs();
            File configFile = new File(cloudflaredDir, "config.yml");
            
            // Create config with explicit DNS settings for emulator
            String config = "# Cloudflared config for Android emulator\n" +
                    "# Explicitly set DNS to Google DNS to avoid emulator's broken [::1]:52 resolver\n" +
                    "dns:\n" +
                    "  servers:\n" +
                    "    - " + primaryDnsServer + ":53\n" +
                    "    - 8.8.4.4:53\n";
            
            try (FileOutputStream fos = new FileOutputStream(configFile)) {
                fos.write(config.getBytes("UTF-8"));
            }
            log("cloudflared config created at " + configFile.getAbsolutePath());
            
            // Try to create a custom /etc/resolv.conf to bypass emulator's broken DNS
            tryCreateResolveConf();
        } catch (Exception e) {
            log("createCloudflaredConfig failed: " + e.getMessage());
        }
    }

    private void tryCreateResolveConf() {
        try {
            // Create a custom resolv.conf in app files directory
            File resolvFile = new File(getContext().getFilesDir(), "resolv.conf");
            String resolveConfig = "nameserver " + primaryDnsServer + "\nnameserver 8.8.4.4\n";
            try (FileOutputStream fos = new FileOutputStream(resolvFile)) {
                fos.write(resolveConfig.getBytes("UTF-8"));
            }
            log("custom resolv.conf created at " + resolvFile.getAbsolutePath());
        } catch (Exception e) {
            log("tryCreateResolveConf failed: " + e.getMessage());
        }
    }

    private void startProcess(File binary, String serviceUrl) throws Exception {
        log("startProcess: resolving api.trycloudflare.com via physical network...");

        // Step 1: resolve DNS via the physical (non-VPN) network.
        Network physicalNetwork = findPhysicalNetwork();
        String apiIp = null;
        if (physicalNetwork != null) {
            try {
                InetAddress[] addrs = physicalNetwork.getAllByName("api.trycloudflare.com");
                if (addrs != null && addrs.length > 0) {
                    apiIp = addrs[0].getHostAddress();
                    log("resolved api.trycloudflare.com via physical network: " + apiIp);
                }
            } catch (Exception e) {
                log("dns resolution via physical network failed: " + e.getMessage());
            }
        }

        // Step 2: if physical network DNS worked, make the API call from Java.
        if (apiIp != null) {
            try {
                URL apiUrl = new URL("https://api.trycloudflare.com/tunnel");
                HttpURLConnection conn = (HttpURLConnection) physicalNetwork.openConnection(apiUrl);
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);

                String body = "{\"url\":\"" + serviceUrl + "\"}";
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.getBytes("UTF-8"));
                }

                int code = conn.getResponseCode();
                log("api.trycloudflare.com response code: " + code);

                if (code == 200) {
                    StringBuilder response = new StringBuilder();
                    try (BufferedReader br = new BufferedReader(
                            new InputStreamReader(conn.getInputStream(), "UTF-8"))) {
                        String line;
                        while ((line = br.readLine()) != null) {
                            response.append(line);
                        }
                    }
                    String json = response.toString();
                    log("API response: " + json);

                    // Try to extract URL from response.
                    JSONObject obj = new JSONObject(json);
                    if (obj.has("result")) {
                        JSONObject result = obj.getJSONObject("result");
                        if (result.has("hostname")) {
                            String hostname = result.getString("hostname");
                            currentUrl = "https://" + hostname;
                            log("tunnel URL: " + currentUrl);
                            if (apiServer != null) apiServer.setTunnelUrl(currentUrl);
                            notifyUrl(currentUrl);
                            running = true;

                            // Also save tunnel credentials and try to run cloudflared
                            // with the existing tunnel to proxy traffic.
                            tryRunWithCredentials(binary, result, serviceUrl);
                            return;
                        }
                    }
                    log("could not find hostname in API response");
                } else {
                    StringBuilder errorBody = new StringBuilder();
                    try (BufferedReader br = new BufferedReader(
                            new InputStreamReader(conn.getErrorStream(), "UTF-8"))) {
                        String line;
                        while ((line = br.readLine()) != null) {
                            errorBody.append(line);
                        }
                    }
                    log("API error: " + code + " " + errorBody.toString());
                }
            } catch (Exception e) {
                log("API call failed: " + e.getMessage());
            }
        }

        // Step 3: fallback - try running cloudflared directly (may fail DNS).
        log("fallback: starting cloudflared directly");
        ProcessBuilder pb = new ProcessBuilder(
                binary.getAbsolutePath(),
                "tunnel",
                "--no-autoupdate",
                "--url", serviceUrl
        );
        pb.environment().put("GODEBUG", "netdns=go");
        pb.redirectErrorStream(true);
        process = pb.start();
        running = true;

        reader = Executors.newSingleThreadExecutor();
        reader.execute(() -> {
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = br.readLine()) != null) {
                    log(line);
                    if (currentUrl == null) {
                        java.util.regex.Matcher m = java.util.regex.Pattern
                                .compile(URL_RE)
                                .matcher(line);
                        if (m.find()) {
                            currentUrl = m.group();
                            if (apiServer != null) apiServer.setTunnelUrl(currentUrl);
                            notifyUrl(currentUrl);
                        }
                    }
                }
            } catch (Exception e) {
                log("reader error: " + e.getMessage());
            } finally {
                running = false;
                currentUrl = null;
                notifyStopped();
            }
        });
    }

    private String extractUrl(String line) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile(URL_RE).matcher(line);
        if (m.find()) {
            return m.group();
        }
        return null;
    }

    private void notifyUrl(String url) {
        JSObject data = new JSObject();
        data.put("url", url);
        notifyListeners("url", data);
    }

    private void notifyStopped() {
        notifyListeners("stopped", new JSObject());
    }
}