import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Collection, Db } from 'mongodb';

import { MermaidGeneratorService } from './mermaid/mermaid-generator.service';
import { DiagramDomainStore } from './commands/diagram-domain.store';
import { MONGO_DB } from '../shared/mongo/mongo.constants';

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

type DiagramDoc = {
  _id: string;
  name: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

const ID_RE = /^[0-9a-zA-Z_]{16}$/;
const ID_CHARSET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';

@Injectable()
export class DiagramsService implements OnModuleInit {
  private readonly logger = new Logger(DiagramsService.name);

  private readonly diagrams: Collection<DiagramDoc>;

  private writeLock: Promise<void> = Promise.resolve();

  constructor(
    @Inject(MONGO_DB) db: Db,
    private readonly mermaid: MermaidGeneratorService,
    private readonly domainStore: DiagramDomainStore,
  ) {
    this.diagrams = db.collection<DiagramDoc>('diagrams');
  }

  async onModuleInit() {
    await this.diagrams.createIndex({ name: 1 });

    const seedEnabled = String(process.env.SEED_SAMPLE_DIAGRAMS ?? '')
      .trim()
      .toLowerCase() === 'true';

    const count = await this.diagrams.countDocuments();

    // Seed sample diagrams only when explicitly enabled.
    if (!seedEnabled) {
      if (count === 0) {
        this.logger.log(
          `Sample diagram seeding is disabled (set SEED_SAMPLE_DIAGRAMS=true to enable). Storage is empty; continuing without seeding.`,
        );
      } else {
        this.logger.log(`Sample diagram seeding is disabled (SEED_SAMPLE_DIAGRAMS!=true).`);
      }
      return;
    }

    if (count > 0) {
      this.logger.log(
        `Sample diagram seeding is enabled (SEED_SAMPLE_DIAGRAMS=true) but storage is not empty; skipping seeding.`,
      );
      return;
    }

    this.logger.log(
      `Sample diagram seeding is enabled (SEED_SAMPLE_DIAGRAMS=true) and storage is empty; seeding now.`,
    );
    await this.seedSampleDiagrams();
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

      const now = new Date();
      await this.diagrams.insertOne({
        _id: id,
        name: sample.name,
        content,
        createdAt: now,
        updatedAt: now,
      });

      this.logger.log(`Seeded sample diagram '${id}': ${sample.name}`);
    }
    this.logger.log(`Seeded ${samples.length} sample diagrams`);
  }

  async list(): Promise<DiagramMetadataEntry[]> {
    const docs = await this.diagrams
      .find(
        {},
        {
          projection: { name: 1 },
        },
      )
      .sort({ name: 1, _id: 1 })
      .toArray();

    return docs.map((d) => ({ id: d._id, name: d.name }));
  }

  async get(id: string): Promise<DiagramEntity> {
    this.assertSafeId(id);

    const doc = await this.diagrams.findOne(
      { _id: id },
      { projection: { name: 1, content: 1 } },
    );
    if (!doc) {
      throw new NotFoundException(`Diagram '${id}' not found`);
    }

    return { id: doc._id, name: doc.name, content: doc.content };
  }

  async create(input: {
    name: string;
    content?: string;
  }): Promise<DiagramEntity> {
    return this.withWriteLock(async () => {
      const name = input.name.trim();
      const content =
        input.content && input.content.trim().length
          ? input.content
          : this.mermaid.initialDiagram(name, 'light');

      const now = new Date();

      // Try a few times in the extremely unlikely event of an id collision.
      for (let attempt = 0; attempt < 10; attempt++) {
        const id = this.generateId();
        try {
          await this.diagrams.insertOne({
            _id: id,
            name,
            content,
            createdAt: now,
            updatedAt: now,
          });

          this.logger.log(`Created diagram '${id}'`);
          return { id, name, content };
        } catch (err: any) {
          if (err?.code === 11000) continue;
          throw err;
        }
      }

      throw new BadRequestException('Failed to generate a unique diagram id');

    });
  }

  async updateContent(id: string, content: string): Promise<DiagramEntity> {
    return this.withWriteLock(async () => {
      this.assertSafeId(id);

      const doc = await this.diagrams.findOneAndUpdate(
        { _id: id },
        { $set: { content, updatedAt: new Date() } },
        { returnDocument: 'after', projection: { name: 1, content: 1 } },
      );
      if (!doc) {
        throw new NotFoundException(`Diagram '${id}' not found`);
      }

      this.logger.log(`Updated content for diagram '${id}'`);
      return { id: doc._id, name: doc.name, content: doc.content };
    });
  }

  async replace(
    id: string,
    input: { name: string; content: string },
  ): Promise<DiagramEntity> {
    return this.withWriteLock(async () => {
      this.assertSafeId(id);

      const name = input.name.trim();
      const content = input.content;

      const doc = await this.diagrams.findOneAndUpdate(
        { _id: id },
        { $set: { name, content, updatedAt: new Date() } },
        { returnDocument: 'after', projection: { name: 1, content: 1 } },
      );
      if (!doc) {
        throw new NotFoundException(`Diagram '${id}' not found`);
      }

      this.logger.log(`Replaced diagram '${id}'`);
      return { id: doc._id, name: doc.name, content: doc.content };
    });
  }

  async delete(id: string): Promise<{ id: string }> {
    return this.withWriteLock(async () => {
      this.assertSafeId(id);

      const res = await this.diagrams.deleteOne({ _id: id });
      if (!res.deletedCount) {
        throw new NotFoundException(`Diagram '${id}' not found`);
      }

      await this.domainStore.delete(id);

      this.logger.log(`Deleted diagram '${id}'`);
      return { id };
    });
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
    // Uniqueness is enforced by MongoDB via the _id primary key.
    return this.randomIdFromCharset(16);
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

}
