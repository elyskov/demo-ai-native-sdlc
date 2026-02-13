import { Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { MongoClient } from 'mongodb';

import { MONGO_CLIENT, MONGO_DB } from './mongo.constants';

@Module({
  providers: [
    {
      provide: MONGO_CLIENT,
      useFactory: async () => {
        const uri = String(process.env.MONGO_URI ?? '').trim();
        if (!uri) {
          throw new Error('MONGO_URI is required');
        }

        const client = new MongoClient(uri, {
          // Compose startup can be racy; keep selection timeouts low and retry.
          serverSelectionTimeoutMS: 2000,
        });

        let lastErr: unknown;
        for (let attempt = 1; attempt <= 30; attempt++) {
          try {
            await client.connect();
            return client;
          } catch (err) {
            lastErr = err;
            // eslint-disable-next-line no-console
            console.warn(`Mongo connect attempt ${attempt}/30 failed; retrying...`);
            await new Promise((r) => setTimeout(r, Math.min(500 * attempt, 5000)));
          }
        }

        await client.close().catch(() => undefined);
        throw lastErr;
      },
    },
    {
      provide: MONGO_DB,
      useFactory: (client: MongoClient) => {
        const dbName = String(process.env.MONGO_DB_NAME ?? 'demo_ai_native_sdlc').trim();
        return client.db(dbName);
      },
      inject: [MONGO_CLIENT],
    },
  ],
  exports: [MONGO_CLIENT, MONGO_DB],
})
export class MongoModule implements OnApplicationShutdown {
  constructor(@Inject(MONGO_CLIENT) private readonly client: MongoClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
