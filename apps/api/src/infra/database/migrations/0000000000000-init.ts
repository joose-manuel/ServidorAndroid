import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
  name = 'Init1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // TypeORM synchronize is OFF; create the initial schema here.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(255) UNIQUE NOT NULL,
        display_name varchar(255) NOT NULL,
        password_hash varchar(255),
        role varchar(32) NOT NULL DEFAULT 'viewer',
        created_at timestamptz NOT NULL DEFAULT now(),
        last_login_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS edge_nodes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(128) NOT NULL,
        device_model varchar(128) NOT NULL,
        os_version varchar(32) NOT NULL,
        app_version varchar(32) NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'online',
        registered_at timestamptz NOT NULL DEFAULT now(),
        last_heartbeat_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS modems (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ip varchar(64) NOT NULL,
        vendor varchar(128) NOT NULL,
        model varchar(128) NOT NULL,
        firmware_version varchar(64),
        status varchar(32) NOT NULL DEFAULT 'unknown',
        last_seen_at timestamptz NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ip inet NOT NULL,
        mac macaddr UNIQUE NOT NULL,
        hostname varchar(255),
        vendor varchar(128),
        status varchar(32) NOT NULL DEFAULT 'known',
        is_whitelisted boolean NOT NULL DEFAULT false,
        first_seen_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS metrics (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        edge_node_id uuid NOT NULL,
        kind varchar(32) NOT NULL,
        payload jsonb NOT NULL,
        measured_at timestamptz NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_metrics_node_time ON metrics (edge_node_id, measured_at DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        edge_node_id uuid NOT NULL,
        category varchar(64) NOT NULL,
        severity varchar(16) NOT NULL,
        title varchar(255) NOT NULL,
        message text NOT NULL,
        metadata jsonb,
        acknowledged_at timestamptz,
        acknowledged_by uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS camera_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        edge_node_id uuid NOT NULL,
        started_by_user_id uuid NOT NULL,
        started_at timestamptz NOT NULL DEFAULT now(),
        ended_at timestamptz,
        facing varchar(16) NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'requested',
        duration_seconds integer,
        encrypted boolean NOT NULL DEFAULT true
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audio_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        edge_node_id uuid NOT NULL,
        started_by_user_id uuid NOT NULL,
        started_at timestamptz NOT NULL DEFAULT now(),
        ended_at timestamptz,
        status varchar(16) NOT NULL DEFAULT 'requested',
        remote_muted boolean NOT NULL DEFAULT false,
        local_muted boolean NOT NULL DEFAULT false,
        duration_seconds integer
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid,
        edge_node_id uuid,
        event varchar(64) NOT NULL,
        ip inet,
        user_agent varchar(512),
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_event_time ON audit_log (event, created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_log`);
    await queryRunner.query(`DROP TABLE IF EXISTS audio_sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS camera_sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS alerts`);
    await queryRunner.query(`DROP TABLE IF EXISTS metrics`);
    await queryRunner.query(`DROP TABLE IF EXISTS devices`);
    await queryRunner.query(`DROP TABLE IF EXISTS modems`);
    await queryRunner.query(`DROP TABLE IF EXISTS edge_nodes`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
