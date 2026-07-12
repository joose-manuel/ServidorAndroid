package com.servidorandroid.edge;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

public class ApiServer {

    private static final String TAG = "ApiServer";

    private final EdgeTunnelPlugin plugin;
    private final int port;
    private ServerSocket serverSocket;
    private volatile boolean running;
    private Thread acceptThread;
    private long startedAt;

    private final AtomicReference<String> tunnelUrl = new AtomicReference<>();
    private final AtomicReference<MetricsSnapshot> latestMetrics = new AtomicReference<>();
    private final ConcurrentHashMap<String, PairingEntry> pairings = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> pendingCodes = new ConcurrentHashMap<>();

    public ApiServer(EdgeTunnelPlugin plugin, int port) {
        this.plugin = plugin;
        this.port = port;
    }

    public void start() throws IOException {
        startedAt = System.currentTimeMillis();
        serverSocket = new ServerSocket();
        serverSocket.setReuseAddress(true);
        serverSocket.bind(new InetSocketAddress(port));
        running = true;
        acceptThread = new Thread(this::acceptLoop, "api-server-accept");
        acceptThread.setDaemon(true);
        acceptThread.start();
        log("HTTP API server started on port " + port);
    }

    public void stop() {
        running = false;
        try {
            if (serverSocket != null && !serverSocket.isClosed()) {
                serverSocket.close();
            }
        } catch (IOException e) {
            log("stop error: " + e.getMessage());
        }
        if (acceptThread != null) {
            acceptThread.interrupt();
        }
        log("HTTP API server stopped");
    }

    public void setTunnelUrl(String url) {
        tunnelUrl.set(url);
        log("tunnel URL set: " + url);
    }

    public String getTunnelUrl() {
        return tunnelUrl.get();
    }

    private void log(String msg) {
        plugin.log("[api] " + msg);
    }

    private void acceptLoop() {
        while (running) {
            try {
                Socket client = serverSocket.accept();
                handleClient(client);
            } catch (IOException e) {
                if (running) {
                    log("accept error: " + e.getMessage());
                }
            }
        }
    }

    private void handleClient(Socket client) {
        try (Socket s = client;
             BufferedReader r = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
             OutputStream w = s.getOutputStream()) {

            String requestLine = r.readLine();
            if (requestLine == null || requestLine.isEmpty()) return;

            String[] parts = requestLine.split(" ", 3);
            if (parts.length < 2) return;
            String method = parts[0];
            String rawPath = parts[1];

            String path = rawPath.contains("?") ? rawPath.substring(0, rawPath.indexOf('?')) : rawPath;
            Map<String, String> query = parseQuery(rawPath);

            int contentLength = 0;
            String line;
            while ((line = r.readLine()) != null && !line.isEmpty()) {
                String lower = line.toLowerCase();
                if (lower.startsWith("content-length:")) {
                    contentLength = Integer.parseInt(line.substring(15).trim());
                }
            }

            String body = "";
            if (contentLength > 0) {
                char[] buf = new char[contentLength];
                int read = r.read(buf, 0, contentLength);
                if (read > 0) {
                    body = new String(buf, 0, read);
                }
            }

            Response resp = route(method, path, query, body);
            sendResponse(w, resp);

        } catch (Exception e) {
            log("handle error: " + e.getMessage());
        }
    }

    private Response route(String method, String path, Map<String, String> query, String body) {
        try {
            if (method.equals("OPTIONS")) {
                return json(204, "");
            }
            if (path.equals("/api/health") || path.equals("/health")) {
                return handleHealth();
            }
            if (path.equals("/api/info") || path.equals("/info")) {
                return handleInfo();
            }
            if (path.equals("/api/metrics/report") && method.equals("POST")) {
                return handleMetricsReport(body);
            }
            if (path.matches("/api/metrics/current/.+")) {
                String id = path.substring(path.lastIndexOf('/') + 1);
                return handleMetricsCurrent(id);
            }
            if (path.equals("/api/edge/register") && method.equals("POST")) {
                return handleEdgeRegister(body);
            }
            if (path.equals("/api/edge/pair") && method.equals("POST")) {
                return handleEdgePair(body);
            }
            if (path.matches("/api/edge/status/.+")) {
                String id = path.substring(path.lastIndexOf('/') + 1);
                return handleEdgeStatus(id);
            }
            if (path.equals("/api/tools/speedtest") && method.equals("POST")) {
                return handleSpeedtest(body);
            }
            return json(404, "{\"error\":\"not found\"}");
        } catch (Exception e) {
            log("route error: " + e.getMessage());
            return json(500, "{\"error\":\"internal error\"}");
        }
    }

    private Response handleHealth() {
        return json(200, "{\"status\":\"ok\",\"uptime\":" + (System.currentTimeMillis() - startedAt) + "}");
    }

    private Response handleInfo() {
        String tu = tunnelUrl.get();
        return json(200, "{"
                + "\"tunnelUrl\":" + (tu != null ? "\"" + tu + "\"" : "null") + ","
                + "\"tunnelActive\":" + (tu != null ? "true" : "false") + ","
                + "\"apiPort\":" + port + ","
                + "\"apiVersion\":\"1.0.0\""
                + "}");
    }

    private Response handleMetricsReport(String body) {
        try {
            MetricsSnapshot snap = MetricsSnapshot.fromJson(body);
            if (snap.edgeNodeId == null) snap.edgeNodeId = "local";
            snap.capturedAt = System.currentTimeMillis();
            latestMetrics.set(snap);
            log("metrics received from " + snap.edgeNodeId);
            return json(200, "{\"ok\":true}");
        } catch (Exception e) {
            log("metrics parse error: " + e.getMessage());
            return json(400, "{\"error\":\"invalid body\"}");
        }
    }

    private Response handleMetricsCurrent(String id) {
        MetricsSnapshot snap = latestMetrics.get();
        if (snap == null) {
            return json(200, "{\"edgeNodeId\":\"" + id + "\",\"capturedAt\":0,\"latencyMs\":null}");
        }
        return json(200, snap.toJson());
    }

    private Response handleEdgeRegister(String body) {
        try {
            Map<String, String> data = parseJson(body);
            String deviceId = data.getOrDefault("deviceId", "local");
            String code = generateCode();
            pendingCodes.put(code, deviceId);
            log("registered " + deviceId + " with code " + code);
            return json(200, "{\"code\":\"" + code + "\",\"deviceId\":\"" + deviceId + "\"}");
        } catch (Exception e) {
            return json(400, "{\"error\":\"invalid body\"}");
        }
    }

    private Response handleEdgePair(String body) {
        try {
            Map<String, String> data = parseJson(body);
            String code = data.get("code");
            if (code == null || code.isEmpty()) {
                return json(400, "{\"error\":\"code required\"}");
            }
            String deviceId = pendingCodes.remove(code);
            if (deviceId == null) {
                return json(404, "{\"error\":\"invalid code\"}");
            }
            pairings.put(deviceId, new PairingEntry(deviceId, System.currentTimeMillis()));
            log("paired " + deviceId + " with code " + code);
            return json(200, "{\"paired\":true,\"deviceId\":\"" + deviceId + "\"}");
        } catch (Exception e) {
            return json(400, "{\"error\":\"invalid body\"}");
        }
    }

    private Response handleEdgeStatus(String deviceId) {
        PairingEntry entry = pairings.get(deviceId);
        if (entry == null) {
            return json(200, "{\"paired\":false}");
        }
        return json(200, "{\"paired\":true,\"pairedAt\":" + entry.pairedAt + ",\"deviceId\":\"" + deviceId + "\"}");
    }

    private Response handleSpeedtest(String body) {
        try {
            Map<String, String> data = parseJson(body);
            MetricsSnapshot snap = latestMetrics.get();
            if (snap == null) snap = new MetricsSnapshot();
            if (data.containsKey("downloadMbps")) {
                snap.downloadMbps = Double.parseDouble(data.get("downloadMbps"));
            }
            if (data.containsKey("uploadMbps")) {
                snap.uploadMbps = Double.parseDouble(data.get("uploadMbps"));
            }
            if (data.containsKey("pingMs")) {
                snap.pingMs = Double.parseDouble(data.get("pingMs"));
            }
            snap.capturedAt = System.currentTimeMillis();
            if (snap.edgeNodeId == null) snap.edgeNodeId = "local";
            latestMetrics.set(snap);
            log("speedtest stored: d=" + snap.downloadMbps + " u=" + snap.uploadMbps + " p=" + snap.pingMs);
            return json(200, "{\"ok\":true,\"downloadMbps\":" + snap.downloadMbps + ",\"uploadMbps\":" + snap.uploadMbps + ",\"pingMs\":" + snap.pingMs + "}");
        } catch (Exception e) {
            return json(400, "{\"error\":\"invalid body\"}");
        }
    }

    private String generateCode() {
        int code = 100000 + (int) (Math.random() * 900000);
        return String.valueOf(code);
    }

    private void sendResponse(OutputStream w, Response resp) throws IOException {
        String headers = "HTTP/1.1 " + resp.code + " " + reason(resp.code) + "\r\n"
                + "Content-Type: application/json\r\n"
                + "Access-Control-Allow-Origin: *\r\n"
                + "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
                + "Access-Control-Allow-Headers: Content-Type\r\n"
                + "Content-Length: " + resp.body.getBytes(StandardCharsets.UTF_8).length + "\r\n"
                + "Connection: close\r\n"
                + "\r\n";
        w.write(headers.getBytes(StandardCharsets.UTF_8));
        w.write(resp.body.getBytes(StandardCharsets.UTF_8));
        w.flush();
    }

    private Response json(int code, String body) {
        return new Response(code, body);
    }

    private String reason(int code) {
        switch (code) {
            case 200: return "OK";
            case 400: return "Bad Request";
            case 404: return "Not Found";
            case 500: return "Internal Server Error";
            default: return "";
        }
    }

    private Map<String, String> parseQuery(String url) {
        Map<String, String> map = new LinkedHashMap<>();
        int q = url.indexOf('?');
        if (q < 0) return map;
        String query = url.substring(q + 1);
        for (String pair : query.split("&")) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2) {
                try {
                    map.put(URLDecoder.decode(kv[0], "UTF-8"), URLDecoder.decode(kv[1], "UTF-8"));
                } catch (Exception ignored) {}
            }
        }
        return map;
    }

    private Map<String, String> parseJson(String json) {
        return parseJsonStatic(json);
    }

    static Map<String, String> parseJsonStatic(String json) {
        Map<String, String> map = new LinkedHashMap<>();
        if (json == null || json.trim().isEmpty()) return map;
        json = json.trim();
        if (!json.startsWith("{") || !json.endsWith("}")) return map;
        json = json.substring(1, json.length() - 1);
        StringBuilder key = new StringBuilder();
        StringBuilder val = new StringBuilder();
        boolean inKey = true;
        boolean inStr = false;
        char esc = 0;
        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (esc != 0) {
                if (inKey) key.append(c);
                else val.append(c);
                esc = 0;
                continue;
            }
            if (c == '\\') {
                esc = 1;
                continue;
            }
            if (c == '"') {
                inStr = !inStr;
                continue;
            }
            if (!inStr) {
                if (c == ':' && inKey) {
                    inKey = false;
                    continue;
                }
                if ((c == ',' || c == '}') && !inKey) {
                    String k = key.toString().trim().replaceAll("^\"|\"$", "");
                    String v = val.toString().trim().replaceAll("^\"|\"$", "");
                    map.put(k, v);
                    key.setLength(0);
                    val.setLength(0);
                    inKey = true;
                    continue;
                }
                if (Character.isWhitespace(c)) continue;
            }
            if (inKey) key.append(c);
            else val.append(c);
        }
        if (!inKey) {
            String k = key.toString().trim().replaceAll("^\"|\"$", "");
            String v = val.toString().trim().replaceAll("^\"|\"$", "");
            map.put(k, v);
        }
        return map;
    }

    private static class Response {
        final int code;
        final String body;
        Response(int code, String body) {
            this.code = code;
            this.body = body;
        }
    }

    private static class PairingEntry {
        final String deviceId;
        final long pairedAt;
        PairingEntry(String deviceId, long pairedAt) {
            this.deviceId = deviceId;
            this.pairedAt = pairedAt;
        }
    }

    static class MetricsSnapshot {
        String edgeNodeId;
        long capturedAt;
        Double latencyMs;
        Double packetLossPercent;
        Double batteryLevelPercent;
        Boolean isCharging;
        Integer connectedDevicesCount;
        Double downloadMbps;
        Double uploadMbps;
        Double pingMs;

        static MetricsSnapshot fromJson(String json) {
            MetricsSnapshot s = new MetricsSnapshot();
            Map<String, String> map = parseJsonStatic(json);
            s.edgeNodeId = map.get("edgeNodeId");
            if (map.containsKey("latencyMs")) s.latencyMs = Double.parseDouble(map.get("latencyMs"));
            if (map.containsKey("packetLossPercent")) s.packetLossPercent = Double.parseDouble(map.get("packetLossPercent"));
            if (map.containsKey("batteryLevelPercent")) s.batteryLevelPercent = Double.parseDouble(map.get("batteryLevelPercent"));
            if (map.containsKey("isCharging")) s.isCharging = Boolean.parseBoolean(map.get("isCharging"));
            if (map.containsKey("connectedDevicesCount")) s.connectedDevicesCount = Integer.parseInt(map.get("connectedDevicesCount"));
            if (map.containsKey("downloadMbps")) s.downloadMbps = Double.parseDouble(map.get("downloadMbps"));
            if (map.containsKey("uploadMbps")) s.uploadMbps = Double.parseDouble(map.get("uploadMbps"));
            if (map.containsKey("pingMs")) s.pingMs = Double.parseDouble(map.get("pingMs"));
            return s;
        }

        String toJson() {
            String ts = "null";
            if (capturedAt > 0) {
                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
                sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                ts = "\"" + sdf.format(new java.util.Date(capturedAt)) + "\"";
            }
            return "{"
                    + "\"edgeNodeId\":\"" + (edgeNodeId != null ? edgeNodeId : "local") + "\","
                    + "\"capturedAt\":" + ts + ","
                    + "\"latency\":" + (latencyMs != null ? ("{\"latencyMs\":" + latencyMs + ",\"target\":\"1.1.1.1\"}") : "null") + ","
                    + "\"battery\":" + (batteryLevelPercent != null ? ("{\"levelPercent\":" + batteryLevelPercent + ",\"isCharging\":" + isCharging + "}") : "null") + ","
                    + "\"speedtest\":" + (downloadMbps != null ? ("{\"downloadMbps\":" + downloadMbps + ",\"uploadMbps\":" + (uploadMbps != null ? uploadMbps : "null") + ",\"pingMs\":" + (pingMs != null ? pingMs : "null") + ",\"measuredAt\":" + ts + ",\"id\":\"local\",\"edgeNodeId\":\"" + (edgeNodeId != null ? edgeNodeId : "local") + "\"}") : "null") + ","
                    + "\"connectedDevicesCount\":" + (connectedDevicesCount != null ? connectedDevicesCount : "null")
                    + "}";
        }
    }
}
