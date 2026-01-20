import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDiagramDto {
  @ApiProperty({ description: 'Human-friendly diagram name', example: 'Web App (prod)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    description:
      'Mermaid diagram content (text). If omitted, backend initializes a deterministic base structure.',
    example: 'graph TD\n  A-->B',
  })
  @IsOptional()
  @IsString()
  content?: string;
}
