import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audio_sessions' })
@Index(['edgeNodeId', 'startedAt'])
export class AudioSessionEntity {
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

  @Column({ type: 'varchar', length: 16, default: 'requested' })
  status!: 'requested' | 'active' | 'muted' | 'ended' | 'failed';

  @Column({ type: 'boolean', name: 'remote_muted', default: false })
  remoteMuted!: boolean;

  @Column({ type: 'boolean', name: 'local_muted', default: false })
  localMuted!: boolean;

  @Column({ type: 'integer', name: 'duration_seconds', nullable: true })
  durationSeconds!: number | null;
}