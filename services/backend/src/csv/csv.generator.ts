import type { CsvDataset } from './models/csv.models';

export const CSV_DATASET_GENERATOR = Symbol('CSV_DATASET_GENERATOR');

export interface CsvDatasetGenerator {
  generate(input: {
    diagramId: string;
    diagramName: string;
    diagramContent: string;
  }): Promise<CsvDataset>;
}
