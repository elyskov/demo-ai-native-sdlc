import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DiagramCommandParentDto {
  @ApiPropertyOptional({ description: 'Parent root key (definitions|infrastructure)', example: 'definitions' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  root?: string;

  @ApiPropertyOptional({ description: 'Parent entity type', example: 'region' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  entity?: string;

  @ApiPropertyOptional({ description: 'Parent entity id', example: '12' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  id?: string;
}

export class DiagramCommandDto {
  @ApiProperty({
    description: 'Domain command name',
    example: 'create',
    enum: ['create', 'update', 'delete', 'move', 'list-types', 'list-elements', 'get-element'],
  })
  @IsString()
  @IsIn(['create', 'update', 'delete', 'move', 'list-types', 'list-elements', 'get-element'])
  command!: 'create' | 'update' | 'delete' | 'move' | 'list-types' | 'list-elements' | 'get-element';

  @ApiProperty({ description: 'Entity type', example: 'site' })
  @IsString()
  @IsNotEmpty()
  entity!: string;

  @ApiPropertyOptional({ description: 'Target object id (required for update/delete/move)', example: '12' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  id?: string;

  @ApiPropertyOptional({ description: 'Parent reference (required when parent required by model)', type: DiagramCommandParentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiagramCommandParentDto)
  parent?: DiagramCommandParentDto;

  @ApiPropertyOptional({ description: 'Entity attributes (validated against netbox-model.yaml)', example: { name: 'Data Center 1', slug: 'dc1', status: 'Active' } })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
