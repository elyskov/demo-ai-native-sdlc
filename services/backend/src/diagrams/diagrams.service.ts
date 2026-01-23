import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { atomicWriteFile, ensureDir, fileExists } from '../shared/fs-utils';

import { MermaidGeneratorService } from './mermaid/mermaid-generator.service';

export type DiagramMetadataEntry = {
  id: string;
  name: string;
};

type DiagramIndexFile = {
  version: 1;
  diagrams: DiagramMetadataEntry[];
};

export type DiagramEntity = {
  id: string;
  name: string;
  content: string;
};

const ID_RE = /^[0-9a-zA-Z_]{16}$/;
const ID_CHARSET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';

@Injectable()
export class DiagramsService implements OnModuleInit {
  private readonly logger = new Logger(DiagramsService.name);

  private readonly diagramsDir = process.env.DIAGRAMS_DIR ?? '/app/diagrams';
  private readonly indexFilePath = path.join(this.diagramsDir, 'index.json');

  private readonly metadataById = new Map<string, DiagramMetadataEntry>();

  private writeLock: Promise<void> = Promise.resolve();

  constructor(private readonly mermaid: MermaidGeneratorService) {}

  async onModuleInit() {
    await ensureDir(this.diagramsDir);
    await this.loadIndex();

    // Seed sample diagrams if empty
    if (this.metadataById.size === 0) {
      await this.seedSampleDiagrams();
    }
  }

  private async seedSampleDiagrams(): Promise<void> {
    const samples = [
      {
        name: 'Sample Deployment 1',
        content: `C4Deployment
    title Sample Deployment Diagram
    Deployment_Node(aws, "AWS Cloud") {
      Deployment_Node(region, "us-east-1") {
        Deployment_Node(vpc, "VPC") {
          Container(backend, "Backend API", "Node.js")
          Container(frontend, "Frontend", "Next.js")
        }
      }
    }
    Rel(frontend, backend, "HTTPS")`,
      },
      {
        name: 'Sample Deployment 2',
        content: `C4Deployment
    title Example Infrastructure
    Deployment_Node(onprem, "On-Premises") {
      Deployment_Node(datacenter, "Data Center") {
        Container(app, "Application", "Java")
        Container(db, "Database", "PostgreSQL")
      }
    }
    Rel(app, db, "SQL")`,
      },
    ];

    for (const sample of samples) {
      const id = this.generateId();
      const content = sample.content;
      const filePath = this.diagramFilePath(id);

      await atomicWriteFile(filePath, content);
      this.metadataById.set(id, { id, name: sample.name });

      this.logger.log(`Seeded sample diagram '${id}': ${sample.name}`);
    }

    await this.persistIndex();
    this.logger.log(`Seeded ${samples.length} sample diagrams`);
  }

  list(): DiagramMetadataEntry[] {
    return [...this.metadataById.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async get(id: string): Promise<DiagramEntity> {
    this.assertSafeId(id);

    const meta = this.metadataById.get(id);
    if (!meta) {
      throw new NotFoundException(`Diagram '${id}' not found`);
    }

    const filePath = this.diagramFilePath(id);
    if (!(await fileExists(filePath))) {
      throw new NotFoundException(`Diagram '${id}' content not found`);
    }

    const content = await fs.readFile(filePath, 'utf8');
    return { id: meta.id, name: meta.name, content };
  }

  async create(input: {
    name: string;
    content?: string;
  }): Promise<DiagramEntity> {
    return this.withWriteLock(async () => {
      const id = this.generateId();

      const name = input.name.trim();
      const content =
        input.content && input.content.trim().length
          ? input.content
          : this.mermaid.initialDiagram(name, 'light');

      const filePath = this.diagramFilePath(id);
      await atomicWriteFile(filePath, content);

      this.metadataById.set(id, { id, name });
      await this.persistIndex();

      this.logger.log(`Created diagram '${id}'`);
      return { id, name, content };
    });
  }

  async updateContent(id: string, content: string): Promise<DiagramEntity> {
    return this.withWriteLock(async () => {
      this.assertSafeId(id);

      const meta = this.metadataById.get(id);
      if (!meta) {
        throw new NotFoundException(`Diagram '${id}' not found`);
      }

      const filePath = this.diagramFilePath(id);
      if (!(await fileExists(filePath))) {
        throw new NotFoundException(`Diagram '${id}' content not found`);
      }

      await atomicWriteFile(filePath, content);
      this.logger.log(`Updated content for diagram '${id}'`);
      return { id, name: meta.name, content };
    });
  }

  async replace(
    id: string,
    input: { name: string; content: string },
  ): Promise<DiagramEntity> {
    return this.withWriteLock(async () => {
      this.assertSafeId(id);

      if (!this.metadataById.has(id)) {
        throw new NotFoundException(`Diagram '${id}' not found`);
      }

      const name = input.name.trim();
      const content = input.content;

      const filePath = this.diagramFilePath(id);
      if (!(await fileExists(filePath))) {
        throw new NotFoundException(`Diagram '${id}' content not found`);
      }

      await atomicWriteFile(filePath, content);

      this.metadataById.set(id, { id, name });
      await this.persistIndex();

      this.logger.log(`Replaced diagram '${id}'`);
      return { id, name, content };
    });
  }

  async delete(id: string): Promise<{ id: string }> {
    return this.withWriteLock(async () => {
      this.assertSafeId(id);

      if (!this.metadataById.has(id)) {
        throw new NotFoundException(`Diagram '${id}' not found`);
      }

      const filePath = this.diagramFilePath(id);
      try {
        await fs.unlink(filePath);
      } catch {
        // If content is already missing, treat as not found.
        throw new NotFoundException(`Diagram '${id}' content not found`);
      }

      this.metadataById.delete(id);
      await this.persistIndex();

      this.logger.log(`Deleted diagram '${id}'`);
      return { id };
    });
  }

  private diagramFilePath(id: string): string {
    return path.join(this.diagramsDir, `${id}.mmd`);
  }

  private assertSafeId(id: string) {
    if (!ID_RE.test(id)) {
      throw new BadRequestException(
        `Invalid diagram id. Expected 16 chars of [0-9a-zA-Z_]`,
      );
    }
  }

  private generateId(): string {
    // 63-character alphabet; use rejection sampling to avoid modulo bias.
    // Collision handling: retry a few times; extremely unlikely for this scale.
    for (let attempt = 0; attempt < 10; attempt++) {
      const id = this.randomIdFromCharset(16);
      if (!this.metadataById.has(id)) {
        return id;
      }
    }
    throw new BadRequestException('Failed to generate a unique diagram id');
  }

  private randomIdFromCharset(length: number): string {
    const alphabet = ID_CHARSET;
    const alphabetSize = alphabet.length; // 63
    const maxUnbiased = Math.floor(256 / alphabetSize) * alphabetSize; // 252

    let result = '';
    while (result.length < length) {
      const bytes = randomBytes(32);
      for (const byte of bytes) {
        if (byte >= maxUnbiased) continue;
        result += alphabet[byte % alphabetSize];
        if (result.length === length) break;
      }
    }
    return result;
  }

  private async withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.writeLock;
    let release!: () => void;
    this.writeLock = new Promise<void>((resolve) => {
      release = resolve;
    });

    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private async loadIndex(): Promise<void> {
    if (!(await fileExists(this.indexFilePath))) {
      await this.persistIndex();
      return;
    }

    try {
      const raw = await fs.readFile(this.indexFilePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DiagramIndexFile>;
      const diagrams = Array.isArray(parsed.diagrams) ? parsed.diagrams : [];

      this.metadataById.clear();
      for (const entry of diagrams) {
        if (
          entry &&
          typeof (entry as any).id === 'string' &&
          typeof (entry as any).name === 'string'
        ) {
          const id = (entry as any).id;
          const name = (entry as any).name;
          if (ID_RE.test(id)) {
            this.metadataById.set(id, { id, name });
          }
        }
      }

      this.logger.log(
        `Loaded diagram index (${this.metadataById.size} entries) from ${this.indexFilePath}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to load diagram index at ${this.indexFilePath}; starting empty`,
        (err as any)?.stack,
      );
      this.metadataById.clear();
      await this.persistIndex();
    }
  }

  private async persistIndex(): Promise<void> {
    const index: DiagramIndexFile = {
      version: 1,
      diagrams: [...this.metadataById.values()].sort((a, b) => a.id.localeCompare(b.id)),
    };

    await atomicWriteFile(this.indexFilePath, JSON.stringify(index, null, 2));
  }
}
