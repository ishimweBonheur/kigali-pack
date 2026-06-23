import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { WebhookEntity } from './entities/webhook.entity';
import {
  WebhookDeliveryEntity,
  WebhookDeliveryStatus,
} from './entities/webhook-delivery.entity';
import { ApiKeyEntity } from '../auth/entities/api-key.entity';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import { NotFoundException } from '@nestjs/common';
import {
  buildPaginationMeta,
  paginateOffset,
} from '../../common/utils/pagination.util';

export const WEBHOOK_DELIVERY_QUEUE = 'webhook-deliveries';
export const WEBHOOK_DLQ = 'webhook-dlq';

export const WEBHOOK_RETRY_DELAYS_MS = [
  60_000,
  300_000,
  900_000,
  3_600_000,
  14_400_000,
];

export interface WebhookDeliveryJob {
  deliveryId: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(WebhookEntity)
    private readonly webhookRepo: Repository<WebhookEntity>,
    @InjectRepository(WebhookDeliveryEntity)
    private readonly deliveryRepo: Repository<WebhookDeliveryEntity>,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<WebhookDeliveryJob>,
  ) {}

  generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  signPayload(secret: string, payload: string, timestamp: number): string {
    const signedContent = `${timestamp}.${payload}`;
    return crypto
      .createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex');
  }

  verifySignature(
    secret: string,
    payload: string,
    timestamp: number,
    signature: string,
  ): boolean {
    const expected = this.signPayload(secret, payload, timestamp);
    if (expected.length !== signature.length) {
      return false;
    }
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  }

  async create(owner: ApiKeyEntity, dto: CreateWebhookDto) {
    const secret = this.generateSecret();
    const webhook = this.webhookRepo.create({
      apiKey: owner,
      url: dto.url,
      secret,
      events: dto.events,
      description: dto.description ?? null,
      isActive: true,
    });
    const saved = await this.webhookRepo.save(webhook);
    return {
      ...this.toResponse(saved),
      secret,
    };
  }

  async list(owner: ApiKeyEntity, page = 1, limit = 20) {
    const offset = paginateOffset(page, limit);

    const [webhooks, total] = await this.webhookRepo.findAndCount({
      where: { apiKey: { id: owner.id } },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      data: webhooks.map((webhook) => this.toResponse(webhook)),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async update(owner: ApiKeyEntity, id: string, dto: UpdateWebhookDto) {
    const webhook = await this.findOwned(owner, id);
    if (dto.url !== undefined) webhook.url = dto.url;
    if (dto.events !== undefined) webhook.events = dto.events;
    if (dto.description !== undefined) webhook.description = dto.description;
    if (dto.isActive !== undefined) webhook.isActive = dto.isActive;
    const saved = await this.webhookRepo.save(webhook);
    return this.toResponse(saved);
  }

  async remove(owner: ApiKeyEntity, id: string) {
    const webhook = await this.findOwned(owner, id);
    await this.webhookRepo.remove(webhook);
    return { deleted: true, id };
  }

  async test(owner: ApiKeyEntity, id: string) {
    const webhook = await this.findOwned(owner, id);
    const payload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { message: 'Kigali-Pack webhook test delivery' },
    };
    const delivery = await this.enqueueDelivery(
      webhook,
      'webhook.test',
      payload,
    );
    return {
      deliveryId: delivery.id,
      status: delivery.status,
      message: 'Test webhook queued for delivery',
    };
  }

  async enqueueDelivery(
    webhook: WebhookEntity,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<WebhookDeliveryEntity> {
    const delivery = this.deliveryRepo.create({
      webhook,
      eventType,
      payload,
      status: WebhookDeliveryStatus.PENDING,
      attemptCount: 0,
      nextRetryAt: new Date(),
    });
    const saved = await this.deliveryRepo.save(delivery);
    await this.deliveryQueue.add(
      'deliver',
      { deliveryId: saved.id },
      { delay: 0, attempts: 1, removeOnComplete: 100, removeOnFail: 100 },
    );
    return saved;
  }

  async dispatchEventForDeveloper(
    apiKeyId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const webhooks = await this.webhookRepo.find({
      where: { apiKey: { id: apiKeyId }, isActive: true },
    });

    const matching = webhooks.filter(
      (webhook) =>
        webhook.events.includes(eventType) ||
        webhook.events.includes('*'),
    );

    await Promise.all(
      matching.map((webhook) =>
        this.enqueueDelivery(webhook, eventType, payload),
      ),
    );
  }

  async listDeliveries(
    owner: ApiKeyEntity,
    webhookId: string,
    page = 1,
    limit = 20,
  ) {
    const webhook = await this.findOwned(owner, webhookId);
    const offset = paginateOffset(page, limit);

    const [deliveries, total] = await this.deliveryRepo.findAndCount({
      where: { webhook: { id: webhook.id } },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      webhookId: webhook.id,
      pagination: buildPaginationMeta(page, limit, total),
      data: deliveries.map((delivery) => this.toDeliveryResponse(delivery, webhook.url)),
    };
  }

  async retryDelivery(
    owner: ApiKeyEntity,
    deliveryId: string,
  ) {
    const original = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
      relations: { webhook: { apiKey: true } },
    });

    if (!original || original.webhook.apiKey.id !== owner.id) {
      throw new NotFoundException(`Delivery ${deliveryId} not found`);
    }

    const retryDelivery = await this.enqueueDelivery(
      original.webhook,
      original.eventType,
      {
        ...original.payload,
        retriedFrom: original.id,
        retriedAt: new Date().toISOString(),
      },
    );

    return {
      originalDeliveryId: original.id,
      retryDelivery: this.toDeliveryResponse(
        retryDelivery,
        original.webhook.url,
      ),
      message: 'Webhook delivery re-queued for outbound HTTP retry',
    };
  }

  private toDeliveryResponse(
    delivery: WebhookDeliveryEntity,
    webhookUrl: string,
  ) {
    return {
      id: delivery.id,
      eventType: delivery.eventType,
      status: delivery.status,
      attempt: delivery.attemptCount,
      durationMs: delivery.durationMs,
      request: {
        url: webhookUrl,
        body: delivery.payload,
      },
      response: {
        statusCode: delivery.responseStatus,
        body: delivery.responseBody,
      },
      errorMessage: delivery.errorMessage,
      createdAt: delivery.createdAt,
      lastAttemptAt: delivery.lastAttemptAt,
    };
  }

  private async findOwned(
    owner: ApiKeyEntity,
    id: string,
  ): Promise<WebhookEntity> {
    const webhook = await this.webhookRepo.findOne({
      where: { id, apiKey: { id: owner.id } },
    });
    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }
    return webhook;
  }

  private toResponse(webhook: WebhookEntity) {
    return {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      description: webhook.description,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    };
  }
}
