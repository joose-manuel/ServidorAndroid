import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'edge_nodes' })
export class EdgeNodeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 128, name: 'device_model' })
  deviceModel!: string;

  @Column({ type: 'varchar', length: 32, name: 'os_version' })
  osVersion!: string;

  @Column({ type: 'varchar', length: 32, name: 'app_version' })
  appVersion!: string;

  @Column({ type: 'varchar', length: 32, default: 'online' })
  status!: 'online' | 'degraded' | 'offline';

  @CreateDateColumn({ name: 'registered_at' })
  registeredAt!: Date;

  @Column({ type: 'timestamptz', name: 'last_heartbeat_at', nullable: true })
  lastHeartbeatAt!: Date | null;
}