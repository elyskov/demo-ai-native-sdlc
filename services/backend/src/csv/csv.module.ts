import { Module } from '@nestjs/common';

import { DiagramsModule } from '../diagrams/diagrams.module';
import { NetboxConfigModule } from '../netbox-config/netbox-config.module';
import { CsvController } from './csv.controller';
import { CSV_DATASET_GENERATOR } from './csv.generator';
import { CsvService } from './csv.service';
import { NetboxCsvDatasetGenerator } from './netbox-csv.generator';

@Module({
  imports: [DiagramsModule, NetboxConfigModule],
  controllers: [CsvController],
  providers: [
    CsvService,
    { provide: CSV_DATASET_GENERATOR, useClass: NetboxCsvDatasetGenerator },
  ],
})
export class CsvModule {}
