import { Module } from '@nestjs/common';

import { DiagramsModule } from '../diagrams/diagrams.module';
import { CsvController } from './csv.controller';
import { CSV_DATASET_GENERATOR } from './csv.generator';
import { CsvService } from './csv.service';
import { MockCsvDatasetGenerator } from './mock-csv.generator';

@Module({
  imports: [DiagramsModule],
  controllers: [CsvController],
  providers: [
    CsvService,
    { provide: CSV_DATASET_GENERATOR, useClass: MockCsvDatasetGenerator },
  ],
})
export class CsvModule {}
