import type { Response } from 'express';
// archiver is CommonJS; use require-import to avoid undefined default export at runtime.
// eslint-disable-next-line @typescript-eslint/no-var-requires
import archiver = require('archiver');
import {
  Controller,
  Get,
  Logger,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CsvOrderedTypesResponse } from './models/csv.models';
import { CsvService } from './csv.service';

function sanitizeFilenamePart(input: string): string {
  // Conservative: keep letters, numbers, space, dash, underscore, dot.
  const cleaned = input.replace(/[^0-9a-zA-Z _.-]+/g, '_').trim();
  return cleaned.length > 0 ? cleaned : 'diagram';
}

function contentDispositionAttachment(filename: string): string {
  // Simple ASCII-friendly attachment header.
  const safe = filename.replace(/[\r\n"]/g, '_');
  return `attachment; filename="${safe}"`;
}

@ApiTags('csv')
@Controller('api/csv')
export class CsvController {
  private readonly logger = new Logger(CsvController.name);

  constructor(private readonly csvService: CsvService) {}

  // IMPORTANT: Keep this route *before* `GET :diagramId`.
  // Otherwise a request to `/api/csv/<id>.zip` would be captured by the generic
  // `:diagramId` handler.
  @Get(':diagramId.zip')
  @ApiProduces('application/zip')
  @ApiOkResponse({
    description: 'ZIP archive containing all CSV files for the diagram',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiBadRequestResponse({ description: 'Invalid diagram id or generator output' })
  @ApiNotFoundResponse({ description: 'Diagram not found' })
  async zip(
    @Param('diagramId') diagramId: string,
    @Res() res: Response,
  ): Promise<void> {
    const dataset = await this.csvService.getArchiveDataset(diagramId);

    const diagramName = sanitizeFilenamePart(dataset.diagramName);
    const zipFilename = `${diagramName}.zip`;

    res.status(200);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', contentDispositionAttachment(zipFilename));

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('warning', (err) => {
      this.logger.warn(`ZIP warning for diagram '${diagramId}': ${String(err)}`);
    });

    archive.on('error', (err) => {
      this.logger.error(
        `ZIP error for diagram '${diagramId}': ${String(err)}`,
        (err as any)?.stack,
      );

      if (!res.headersSent) {
        res.status(500);
      }
      res.end();
    });

    archive.pipe(res);

    for (const el of dataset.elements) {
      const csvFilename = `${diagramName}_${el.type}.csv`;
      archive.append(el.csvContent, { name: csvFilename });
    }

    await archive.finalize();
  }

  @Get(':diagramId')
  @ApiQuery({
    name: 'category',
    required: true,
    description: 'Type category derived from NetBox model roots (e.g. Definitions, Infrastructure)',
    example: 'Definitions',
  })
  @ApiOkResponse({ type: CsvOrderedTypesResponse })
  @ApiBadRequestResponse({ description: 'Invalid diagram id or generator output' })
  @ApiNotFoundResponse({ description: 'Diagram not found' })
  async list(
    @Param('diagramId') diagramId: string,
    @Query('category') category?: string,
  ): Promise<CsvOrderedTypesResponse> {
    return this.csvService.listOrderedTypes(diagramId, category);
  }

  @Get(':diagramId/:type')
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'Single CSV file download',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiBadRequestResponse({ description: 'Invalid diagram id/type or generator output' })
  @ApiNotFoundResponse({ description: 'Diagram or type not found' })
  async getCsv(
    @Param('diagramId') diagramId: string,
    @Param('type') type: string,
    @Res() res: Response,
  ): Promise<void> {
    const { dataset, element } = await this.csvService.getCsvElement(diagramId, type);

    const diagramName = sanitizeFilenamePart(dataset.diagramName);
    const csvFilename = `${diagramName}_${element.type}.csv`;

    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', contentDispositionAttachment(csvFilename));
    res.send(element.csvContent);
  }
}
