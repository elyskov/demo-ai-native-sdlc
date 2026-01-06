import { ApiProperty } from '@nestjs/swagger';

export class CsvElement {
  @ApiProperty({ description: 'Unique type within the dataset', example: 'devices' })
  type!: string;

  @ApiProperty({ description: 'CSV content as UTF-8 text', example: 'name,role\nweb-01,web\n' })
  csvContent!: string;
}

export class CsvDataset {
  @ApiProperty({ example: 'hcqOn88HKnyHcHE6' })
  diagramId!: string;

  @ApiProperty({ example: 'Web App (prod)' })
  diagramName!: string;

  @ApiProperty({ type: CsvElement, isArray: true })
  elements!: CsvElement[];
}

export class CsvTypesResponse {
  @ApiProperty({ example: 'hcqOn88HKnyHcHE6' })
  diagramId!: string;

  @ApiProperty({ example: 'Web App (prod)' })
  diagramName!: string;

  @ApiProperty({
    description: 'Available CSV element types',
    example: ['devices', 'interfaces'],
    isArray: true,
    type: String,
  })
  types!: string[];
}
