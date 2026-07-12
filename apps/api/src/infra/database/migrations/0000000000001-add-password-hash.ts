import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordHash1700000000001 implements MigrationInterface {
  name = 'AddPasswordHash1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE users ALTER COLUMN display_name SET DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users DROP COLUMN IF EXISTS password_hash`,
    );
  }
}
