import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'metrics' })
@Index(['edgeNodeId', 'measuredAt'])
export class MetricEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'edge_node_id' })
  edgeNodeId!: string;

  @Column({ type: 'varchar', length: 32 })
  kind!: 'latency' | 'bandwidth' | 'battery' | 'speedtest';

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'measured_at' })
  measuredAt!: Date;
}