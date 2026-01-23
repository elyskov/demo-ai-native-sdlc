import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

import { DiagramCommandDto } from './dto/diagram-command.dto';
import { DiagramsCommandsService } from './diagrams-commands.service';

@ApiTags('diagrams')
@Controller('api/diagrams')
export class DiagramsCommandsController {
  constructor(private readonly commands: DiagramsCommandsService) {}

  @Post(':id/commands')
  @ApiOkResponse()
  @ApiNotFoundResponse({ description: 'Diagram not found' })
  @ApiBadRequestResponse({ description: 'Validation error' })
  async apply(
    @Param('id') id: string,
    @Body() dto: DiagramCommandDto,
  ): Promise<any> {
    return this.commands.apply(id, dto);
  }
}
