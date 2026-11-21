import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getServerEnv } from '@workspace/env';
import { AlertWorkerModule } from './alert-worker.module';
import { AlertWorkerService } from './alert-worker.service';

const logger = new Logger('AlertWorker');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AlertWorkerModule);
  const worker = app.get(AlertWorkerService);
  const runOnce = process.argv.includes('--once');
  let stopping = false;
  let wake: (() => void) | undefined;

  const stop = () => {
    stopping = true;
    wake?.();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  if (runOnce) {
    try {
      const result = await worker.runOnce();
      logger.log(JSON.stringify(result));
    } finally {
      await app.close();
    }
    return;
  }

  const intervalMs = getServerEnv().ALERT_SCAN_INTERVAL_MS;
  logger.log(`Alert worker started with a ${intervalMs}ms scan interval`);
  while (!stopping) {
    try {
      const result = await worker.runOnce();
      logger.log(JSON.stringify(result));
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : 'Alert worker iteration failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, intervalMs);
      wake = () => {
        clearTimeout(timeout);
        resolve();
      };
    });
    wake = undefined;
  }

  await app.close();
}

bootstrap().catch((error: unknown) => {
  logger.error(
    error instanceof Error ? error.message : 'Alert worker failed to start',
    error instanceof Error ? error.stack : undefined,
  );
  process.exitCode = 1;
});
