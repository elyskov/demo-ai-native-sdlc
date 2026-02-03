import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';

import { DiagramDomainStore } from '../diagrams/commands/diagram-domain.store';
import { DiagramsService } from '../diagrams/diagrams.service';
import { NetboxModelAnalysisService } from '../netbox-config/netbox-model-analysis.service';
import type { CsvDataset, CsvElement } from './models/csv.models';
import { CSV_DATASET_GENERATOR } from './csv.generator';
import type { CsvDatasetGenerator } from './csv.generator';

const TYPE_RE = /^[0-9a-zA-Z_-]{1,64}$/;

@Injectable()
export class CsvService {
  private readonly logger = new Logger(CsvService.name);

  constructor(
    private readonly diagramsService: DiagramsService,
    private readonly domainStore: DiagramDomainStore,
    private readonly modelAnalysis: NetboxModelAnalysisService,
    @Inject(CSV_DATASET_GENERATOR) private readonly generator: CsvDatasetGenerator,
  ) {}

  async listOrderedTypes(
    diagramId: string,
    category?: string,
  ): Promise<{ diagramId: string; category: string; types: string[] }> {
    if (typeof category !== 'string' || !category.trim()) {
      const allowed = this.modelAnalysis.getAllowedCategories();
      throw new BadRequestException(
        `Query parameter 'category' is required. Allowed categories: ${allowed.join(', ')}`,
      );
    }

    const rootKey = this.modelAnalysis.resolveRootKeyFromCategory(category);
    if (!rootKey) {
      const allowed = this.modelAnalysis.getAllowedCategories();
      throw new BadRequestException(
        `Invalid category '${category}'. Allowed categories: ${allowed.join(', ')}`,
      );
    }

    // Ensures unknown diagramId returns 404.
    const diagram = await this.diagramsService.get(diagramId);

    const state = await this.domainStore.load(diagramId);
    const presentTypes = new Set(
      state.objects
        .map((o) => (o && typeof o.entity === 'string' ? o.entity : ''))
        .filter((v) => Boolean(v)),
    );

    // Include dependencies (within the category) for the types present in the diagram.
    const needed = this.modelAnalysis.getNeededTypesForRoot(rootKey, presentTypes);
    const ordered = this.modelAnalysis.getOrderedTypesForRoot(rootKey);

    return {
      diagramId: diagram.id,
      category: this.modelAnalysis.getCategoryNameForRoot(rootKey),
      types: ordered.filter((t) => needed.has(t)),
    };
  }

  async getCsvElement(diagramId: string, type: string): Promise<{ dataset: CsvDataset; element: CsvElement }> {
    if (!TYPE_RE.test(type)) {
      throw new BadRequestException('Invalid type');
    }

    const dataset = await this.getDataset(diagramId);
    const element = dataset.elements.find((e) => e.type === type);
    if (!element) {
      const allowed = dataset.elements.map((e) => e.type).sort((a, b) => a.localeCompare(b));
      throw new BadRequestException(
        `Invalid type '${type}'. Allowed types for this diagram: ${allowed.join(', ')}`,
      );
    }

    return { dataset, element };
  }

  async getArchiveDataset(diagramId: string): Promise<CsvDataset> {
    return this.getDataset(diagramId);
  }

  private async getDataset(diagramId: string): Promise<CsvDataset> {
    const diagram = await this.diagramsService.get(diagramId);

    const dataset = await this.generator.generate({
      diagramId: diagram.id,
      diagramName: diagram.name,
      diagramContent: diagram.content,
    });

    if (!dataset?.elements || !Array.isArray(dataset.elements)) {
      throw new BadRequestException('CSV generator returned an invalid dataset');
    }

    const seen = new Set<string>();
    for (const el of dataset.elements) {
      if (!el || typeof el.type !== 'string' || typeof el.csvContent !== 'string') {
        throw new BadRequestException('CSV generator returned an invalid element');
      }
      if (!TYPE_RE.test(el.type)) {
        throw new BadRequestException(`CSV type '${el.type}' is invalid`);
      }
      if (seen.has(el.type)) {
        throw new BadRequestException(`CSV type '${el.type}' is duplicated in dataset`);
      }
      seen.add(el.type);
    }

    if (dataset.elements.length === 0) {
      this.logger.warn(`CSV dataset for diagram '${diagramId}' is empty`);
    } else {
      this.logger.log(
        `Generated CSV dataset for diagram '${diagramId}' (${dataset.elements.length} files)`,
      );
    }

    return dataset;
  }
}
