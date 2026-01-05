import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateDiagramDto {
  @ApiPropertyOptional({
    description:
      'Diagram id used for filename (<id>.mmd). If omitted, server generates one.',
    example: 'webapp-prod',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  id?: string;

  @ApiProperty({ description: 'Human-friendly diagram name', example: 'Web App (prod)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({
    description: 'Mermaid diagram content (text)',
    example: 'graph TD\n  A-->B',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
