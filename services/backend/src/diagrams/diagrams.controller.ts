import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreateDiagramDto } from './dto/create-diagram.dto';
import { UpdateDiagramDto } from './dto/update-diagram.dto';
import { Diagram, DiagramMetadata } from './models/diagram.models';
import { DiagramsService } from './diagrams.service';

@ApiTags('diagrams')
@Controller('api/diagrams')
export class DiagramsController {
  constructor(private readonly diagramsService: DiagramsService) {}

  @Get()
  @ApiOkResponse({ type: DiagramMetadata, isArray: true })
  async list(): Promise<DiagramMetadata[]> {
    return this.diagramsService.list();
  }

  @Get(':id')
  @ApiOkResponse({ type: Diagram })
  @ApiNotFoundResponse({ description: 'Diagram not found' })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  async get(@Param('id') id: string): Promise<Diagram> {
    return this.diagramsService.get(id);
  }

  @Post()
  @ApiCreatedResponse({ type: Diagram })
  @ApiBadRequestResponse({ description: 'Validation error' })
  async create(@Body() dto: CreateDiagramDto): Promise<Diagram> {
    return this.diagramsService.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: Diagram })
  @ApiNotFoundResponse({ description: 'Diagram not found' })
  @ApiBadRequestResponse({ description: 'Validation error' })
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<UpdateDiagramDto>,
  ): Promise<Diagram> {
    // Partial update: rename only (content remains unchanged)
    const current = await this.diagramsService.get(id);
    return this.diagramsService.replace(id, {
      name: dto.name ?? current.name,
      content: current.content,
    });
  }

  @Put(':id')
  @ApiOkResponse({ type: Diagram })
  @ApiNotFoundResponse({ description: 'Diagram not found' })
  @ApiBadRequestResponse({ description: 'Validation error' })
  async replace(
    @Param('id') id: string,
    @Body() dto: UpdateDiagramDto,
  ): Promise<Diagram> {
    return this.diagramsService.replace(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  })
  @ApiNotFoundResponse({ description: 'Diagram not found' })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  async delete(@Param('id') id: string): Promise<{ id: string }> {
    return this.diagramsService.delete(id);
  }
}
