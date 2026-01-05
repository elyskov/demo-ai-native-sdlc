import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDiagramDto {
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
