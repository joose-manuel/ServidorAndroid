import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'modems' })
export class ModemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  ip!: string;

  @Column({ type: 'varchar', length: 128 })
  vendor!: string;

  @Column({ type: 'varchar', length: 128 })
  model!: string;

  @Column({ type: 'varchar', length: 64, name: 'firmware_version', nullable: true })
  firmwareVersion!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'unknown' })
  status!: 'online' | 'rebooting' | 'offline' | 'unknown';

  @Column({ type: 'timestamptz', name: 'last_seen_at' })
  lastSeenAt!: Date;
}