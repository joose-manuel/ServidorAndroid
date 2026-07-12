-- ============================================================================
-- SERVIDOR ANDROID EDGE NODE - DATABASE SCHEMA
-- ============================================================================

-- ============================================================================
-- 1. EDGE NODES TABLE
-- ============================================================================
CREATE TABLE edge_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  battery_level INT DEFAULT 100,
  ip_address VARCHAR(50),
  status VARCHAR(50) DEFAULT 'offline',  -- offline, online, streaming
  last_heartbeat TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_edge_nodes_user_id ON edge_nodes(user_id);
CREATE INDEX idx_edge_nodes_device_id ON edge_nodes(device_id);
CREATE INDEX idx_edge_nodes_status ON edge_nodes(status);

-- ============================================================================
-- 2. METRICS TABLE (Time-series)
-- ============================================================================
CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  edge_node_id UUID NOT NULL REFERENCES edge_nodes(id) ON DELETE CASCADE,
  latency INT,
  bandwidth INT,
  battery INT,
  device_count INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_metrics_edge_node_id ON metrics(edge_node_id);
CREATE INDEX idx_metrics_created_at ON metrics(created_at);

-- ============================================================================
-- 3. WEBRTC SESSIONS TABLE (Auditoría)
-- ============================================================================
CREATE TABLE webrtc_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  edge_node_id UUID NOT NULL REFERENCES edge_nodes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type VARCHAR(50) NOT NULL,  -- 'camera', 'audio', 'both'
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP DEFAULT NULL,
  duration_seconds INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webrtc_sessions_edge_node_id ON webrtc_sessions(edge_node_id);
CREATE INDEX idx_webrtc_sessions_user_id ON webrtc_sessions(user_id);
CREATE INDEX idx_webrtc_sessions_created_at ON webrtc_sessions(created_at);

-- ============================================================================
-- 4. NETWORK DEVICES TABLE
-- ============================================================================
CREATE TABLE network_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  edge_node_id UUID NOT NULL REFERENCES edge_nodes(id) ON DELETE CASCADE,
  mac_address VARCHAR(17) NOT NULL,
  ip_address VARCHAR(50),
  device_name VARCHAR(255),
  is_known BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(edge_node_id, mac_address)
);

CREATE INDEX idx_network_devices_edge_node_id ON network_devices(edge_node_id);
CREATE INDEX idx_network_devices_mac_address ON network_devices(mac_address);

-- ============================================================================
-- 5. ALERTS TABLE
-- ============================================================================
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  edge_node_id UUID NOT NULL REFERENCES edge_nodes(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,  -- 'battery_low', 'offline', 'unknown_device'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'info',  -- 'info', 'warning', 'critical'
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX idx_alerts_edge_node_id ON alerts(edge_node_id);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_is_resolved ON alerts(is_resolved);

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE edge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE webrtc_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- edge_nodes policies
CREATE POLICY "Users can view their own edge nodes"
  ON edge_nodes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own edge nodes"
  ON edge_nodes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own edge nodes"
  ON edge_nodes FOR UPDATE
  USING (auth.uid() = user_id);

-- metrics policies
CREATE POLICY "Users can view metrics of their edge nodes"
  ON metrics FOR SELECT
  USING (
    edge_node_id IN (
      SELECT id FROM edge_nodes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert metrics to their edge nodes"
  ON metrics FOR INSERT
  WITH CHECK (
    edge_node_id IN (
      SELECT id FROM edge_nodes WHERE user_id = auth.uid()
    )
  );

-- webrtc_sessions policies
CREATE POLICY "Users can view their webrtc sessions"
  ON webrtc_sessions FOR SELECT
  USING (
    auth.uid() = user_id OR
    edge_node_id IN (SELECT id FROM edge_nodes WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert webrtc sessions"
  ON webrtc_sessions FOR INSERT
  WITH CHECK (
    edge_node_id IN (
      SELECT id FROM edge_nodes WHERE user_id = auth.uid()
    )
  );

-- network_devices policies
CREATE POLICY "Users can view devices on their edge nodes"
  ON network_devices FOR SELECT
  USING (
    edge_node_id IN (
      SELECT id FROM edge_nodes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert devices to their edge nodes"
  ON network_devices FOR INSERT
  WITH CHECK (
    edge_node_id IN (
      SELECT id FROM edge_nodes WHERE user_id = auth.uid()
    )
  );

-- alerts policies
CREATE POLICY "Users can view alerts from their edge nodes"
  ON alerts FOR SELECT
  USING (
    edge_node_id IN (
      SELECT id FROM edge_nodes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert alerts to their edge nodes"
  ON alerts FOR INSERT
  WITH CHECK (
    edge_node_id IN (
      SELECT id FROM edge_nodes WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Enable realtime on specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE edge_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;

-- ============================================================================
-- 8. FUNCTIONS
-- ============================================================================

-- Function to update edge_nodes.updated_at
CREATE OR REPLACE FUNCTION update_edge_nodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for update_edge_nodes_updated_at
CREATE TRIGGER trigger_update_edge_nodes_updated_at
BEFORE UPDATE ON edge_nodes
FOR EACH ROW
EXECUTE FUNCTION update_edge_nodes_updated_at();

-- Function to auto-resolve alerts when node comes online
CREATE OR REPLACE FUNCTION resolve_offline_alerts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'online' AND OLD.status = 'offline' THEN
    UPDATE alerts
    SET is_resolved = TRUE, resolved_at = NOW()
    WHERE edge_node_id = NEW.id
      AND alert_type = 'offline'
      AND is_resolved = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for resolve_offline_alerts
CREATE TRIGGER trigger_resolve_offline_alerts
AFTER UPDATE ON edge_nodes
FOR EACH ROW
EXECUTE FUNCTION resolve_offline_alerts();
