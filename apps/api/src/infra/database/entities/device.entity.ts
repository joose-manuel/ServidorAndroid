import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'devices' })
@Index(['mac'], { unique: true })
export class DeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'inet' })
  ip!: string;

  @Column({ type: 'macaddr' })
  mac!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  hostname!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  vendor!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'known' })
  status!: 'known' | 'unknown' | 'suspicious' | 'offline';

  @Column({ type: 'boolean', name: 'is_whitelisted', default: false })
  isWhitelisted!: boolean;

  @CreateDateColumn({ name: 'first_seen_at' })
  firstSeenAt!: Date;

  @Column({ type: 'timestamptz', name: 'last_seen_at' })
  lastSeenAt!: Date;
}