import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'camera_sessions' })
@Index(['edgeNodeId', 'startedAt'])
export class CameraSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'edge_node_id' })
  edgeNodeId!: string;

  @Column({ type: 'uuid', name: 'started_by_user_id' })
  startedByUserId!: string;

  @CreateDateColumn({ name: 'started_at' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', name: 'ended_at', nullable: true })
  endedAt!: Date | null;

  @Column({ type: 'varchar', length: 16 })
  facing!: 'front' | 'back';

  @Column({ type: 'varchar', length: 16, default: 'requested' })
  status!: 'requested' | 'active' | 'ended' | 'denied' | 'failed';

  @Column({ type: 'integer', name: 'duration_seconds', nullable: true })
  durationSeconds!: number | null;

  @Column({ type: 'boolean', default: true })
  encrypted!: boolean;
}