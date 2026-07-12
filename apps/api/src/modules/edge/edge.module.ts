import { Module } from '@nestjs/common';
import { EdgeController } from './edge.controller';
import { EdgeStore } from './edge.store';

@Module({ controllers: [EdgeController], providers: [EdgeStore], exports: [EdgeStore] })
export class EdgeModule {}

