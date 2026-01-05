import { ApiProperty } from '@nestjs/swagger';

export class DiagramMetadata {
  @ApiProperty({ example: 'webapp-prod' })
  id!: string;

  @ApiProperty({ example: 'Web App (prod)' })
  name!: string;
}

export class Diagram extends DiagramMetadata {
  @ApiProperty({ example: 'graph TD\n  A-->B' })
  content!: string;
}
