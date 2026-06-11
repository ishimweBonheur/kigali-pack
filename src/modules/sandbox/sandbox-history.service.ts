import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MockTransactionEntity } from './entities/mock-transaction.entity';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class SandboxHistoryService {
  constructor(
    @InjectRepository(MockTransactionEntity)
    private readonly txRepo: Repository<MockTransactionEntity>,
  ) {}

  async listHistory(apiKeyId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const [transactions, total] = await this.txRepo
      .createQueryBuilder('tx')
      .where('tx.api_key_id = :apiKeyId', { apiKeyId })
      .orderBy('tx.created_at', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return {
      pagination: { page, limit, total },
      data: transactions.map((tx) => this.serialize(tx)),
    };
  }

  async getById(apiKeyId: string, transactionId: string) {
    const tx = await this.txRepo.findOne({
      where: { id: transactionId },
      relations: { apiKey: true },
    });

    if (!tx || tx.apiKey.id !== apiKeyId) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    return this.serialize(tx);
  }

  private serialize(tx: MockTransactionEntity) {
    return {
      transactionId: tx.id,
      phoneNumber: tx.phoneNumber,
      amount: Number(tx.amount),
      status: tx.status,
      provider: tx.gateway,
      failureReason: tx.failureReason,
      clientReference: tx.clientReference,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt,
    };
  }
}
