import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseLoggerService implements OnModuleInit {
  private readonly logger = new Logger('Database');

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit() {
    if (this.dataSource.isInitialized) {
      this.logger.log('Conexión a la base de datos establecida correctamente');
      return;
    }

    this.logger.warn(
      'La conexión a la base de datos todavía no se ha inicializado al montar el módulo',
    );
  }
}
