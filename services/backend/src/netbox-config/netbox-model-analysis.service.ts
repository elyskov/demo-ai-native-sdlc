import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import type { NetboxModelConfig } from './netbox-config.models';
import { NetboxModelService } from './netbox-model.service';
import {
  analyzeModelByRoot,
  closureWithDependencies,
  normalizeCategoryInput,
  titleCaseCategory,
  type CategoryAnalysis,
} from './netbox-model-analysis';

export type CsvCategory = {
  rootKey: string;
  name: string;
};

@Injectable()
export class NetboxModelAnalysisService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NetboxModelAnalysisService.name);

  private model!: NetboxModelConfig;
  private analysesByRootKey: Record<string, CategoryAnalysis> = {};
  private categories: CsvCategory[] = [];

  constructor(private readonly modelService: NetboxModelService) {}

  onApplicationBootstrap(): void {
    this.model = this.modelService.get();

    this.analysesByRootKey = analyzeModelByRoot(this.model);

    this.categories = Object.keys(this.analysesByRootKey)
      .sort((a, b) => a.localeCompare(b))
      .map((rootKey) => ({ rootKey, name: titleCaseCategory(rootKey) }));

    const summary = this.categories
      .map((c) => `${c.name}=${this.analysesByRootKey[c.rootKey].ordered.length}`)
      .join(', ');

    this.logger.log(
      `NetBox model analysis ready (categories: ${this.categories.length}; ${summary})`,
    );
  }

  getAllowedCategories(): string[] {
    return this.categories.map((c) => c.name);
  }

  getCategoryNameForRoot(rootKey: string): string {
    const found = this.categories.find((c) => c.rootKey === rootKey);
    return found?.name ?? titleCaseCategory(rootKey);
  }

  /**
   * Converts API category input (e.g. 'Definitions') to a root key (e.g. 'definitions').
   */
  resolveRootKeyFromCategory(category: string): string | null {
    const norm = normalizeCategoryInput(category);

    // Allow both TitleCase and raw root keys.
    for (const c of this.categories) {
      if (norm === normalizeCategoryInput(c.name) || norm === normalizeCategoryInput(c.rootKey)) {
        return c.rootKey;
      }
    }

    return null;
  }

  getOrderedTypesForRoot(rootKey: string): string[] {
    const a = this.analysesByRootKey[rootKey];
    if (!a) throw new Error(`Unknown rootKey '${rootKey}'`);
    return a.ordered.slice();
  }

  getAnalysisForRoot(rootKey: string): CategoryAnalysis {
    const a = this.analysesByRootKey[rootKey];
    if (!a) throw new Error(`Unknown rootKey '${rootKey}'`);
    return a;
  }

  getNeededTypesForRoot(rootKey: string, seedTypes: Iterable<string>): Set<string> {
    const analysis = this.getAnalysisForRoot(rootKey);
    return closureWithDependencies(analysis, seedTypes);
  }
}
