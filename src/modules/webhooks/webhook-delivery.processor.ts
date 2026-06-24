import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  WebhookDeliveryEntity,
  WebhookDeliveryStatus,
} from './entities/webhook-delivery.entity';
import {
  WEBHOOK_DELIVERY_QUEUE,
  WEBHOOK_DLQ,
  WEBHOOK_RETRY_DELAYS_MS,
  WebhookDeliveryJob,
  WebhookService,
} from './webhook.service';
import { WEBHOOK_SIGNATURE_HEADER } from '../../common/utils/webhook-signing.util';

@Processor(WEBHOOK_DELIVERY_QUEUE)
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(
    @InjectRepository(WebhookDeliveryEntity)
    private readonly deliveryRepo: Repository<WebhookDeliveryEntity>,
    private readonly httpService: HttpService,
    private readonly webhookService: WebhookService,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<WebhookDeliveryJob>,
    @InjectQueue(WEBHOOK_DLQ)
    private readonly dlq: Queue<WebhookDeliveryJob>,
  ) {
    super();
  }

  async process(job: Job<WebhookDeliveryJob>): Promise<void> {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: job.data.deliveryId },
      relations: { webhook: true },
    });

    if (!delivery || !delivery.webhook.isActive) {
      return;
    }

    const payloadString = JSON.stringify({
      id: delivery.id,
      type: delivery.eventType,
      created: delivery.createdAt.toISOString(),
      data: delivery.payload,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureHeader = this.webhookService.buildSignatureHeader(
      delivery.webhook.secret,
      payloadString,
      timestamp,
    );

    delivery.attemptCount += 1;
    delivery.lastAttemptAt = new Date();
    const attemptStarted = Date.now();

    try {
      const response = await firstValueFrom(
        this.httpService.post(delivery.webhook.url, payloadString, {
          headers: {
            'Content-Type': 'application/json',
            [WEBHOOK_SIGNATURE_HEADER]: signatureHeader,
            'X-Kigali-Pack-Event': delivery.eventType,
          },
          timeout: 10_000,
          validateStatus: () => true,
        }),
      );

      delivery.durationMs = Date.now() - attemptStarted;

      delivery.responseStatus = response.status;
      delivery.responseBody = JSON.stringify(response.data).slice(0, 2000);

      if (response.status >= 200 && response.status < 300) {
        delivery.status = WebhookDeliveryStatus.DELIVERED;
        delivery.nextRetryAt = null;
        delivery.errorMessage = null;
        await this.deliveryRepo.save(delivery);
        return;
      }

      throw new Error(`HTTP ${response.status} from webhook endpoint`);
    } catch (error) {
      delivery.durationMs = Date.now() - attemptStarted;
      const message = error instanceof Error ? error.message : String(error);
      delivery.errorMessage = message.slice(0, 500);

      if (delivery.attemptCount >= delivery.maxAttempts) {
        delivery.status = WebhookDeliveryStatus.DLQ;
        delivery.nextRetryAt = null;
        await this.deliveryRepo.save(delivery);
        await this.dlq.add('dead-letter', { deliveryId: delivery.id });
        this.logger.error(
          `Webhook delivery ${delivery.id} moved to DLQ after ${delivery.attemptCount} attempts`,
        );
        return;
      }

      delivery.status = WebhookDeliveryStatus.FAILED;
      const delayIndex = Math.min(
        delivery.attemptCount - 1,
        WEBHOOK_RETRY_DELAYS_MS.length - 1,
      );
      const delayMs = WEBHOOK_RETRY_DELAYS_MS[delayIndex];
      delivery.nextRetryAt = new Date(Date.now() + delayMs);
      await this.deliveryRepo.save(delivery);

      await this.deliveryQueue.add(
        'deliver-retry',
        { deliveryId: delivery.id },
        { delay: delayMs, attempts: 1 },
      );

      this.logger.warn(
        `Webhook delivery ${delivery.id} failed (attempt ${delivery.attemptCount}). Retrying in ${delayMs}ms`,
      );
    }
  }
}
