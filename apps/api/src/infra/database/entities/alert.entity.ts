import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'alerts' })
@Index(['edgeNodeId', 'createdAt'])
export class AlertEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'edge_node_id' })
  edgeNodeId!: string;

  @Column({ type: 'varchar', length: 64 })
  category!: string;

  @Column({ type: 'varchar', length: 16 })
  severity!: 'info' | 'warning' | 'critical';

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', name: 'acknowledged_at', nullable: true })
  acknowledgedAt!: Date | null;

  @Column({ type: 'uuid', name: 'acknowledged_by', nullable: true })
  acknowledgedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}