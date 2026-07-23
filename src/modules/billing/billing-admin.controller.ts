import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { BillingAdminService } from './billing-admin.service';
import { SubscriptionStatus } from './entities/subscription.entity';
import { PaymentRequestStatus } from './entities/payment-request.entity';
import { AuditAction } from './entities/audit-log.entity';
import type { JwtPayload } from '../organizations/organization.service';
import { Admin } from '../../common/decorators/admin.decorator';

@ApiTags('Admin Billing')
@ApiBearerAuth('jwt')
@Controller('v1/admin/billing')
@UseGuards(AdminGuard)
export class BillingAdminController {
  constructor(private readonly billingAdminService: BillingAdminService) {}

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin billing dashboard statistics' })
  getDashboardStats() {
    return this.billingAdminService.getAdminDashboardStats();
  }

  // ==================== PAYMENTS ====================

  @Get('payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all payment requests' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', enum: PaymentRequestStatus, required: false })
  @ApiQuery({ name: 'search', required: false })
  listPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: PaymentRequestStatus,
    @Query('search') search?: string,
  ) {
    return this.billingAdminService.listPaymentRequests({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      search,
    });
  }

  @Get('payments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get payment request details' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingAdminService.getPaymentRequest(id);
  }

  @Post('payments/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending payment request' })
  @ApiParam({ name: 'id', format: 'uuid' })
  approvePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { adminNotes?: string },
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.approvePayment(id, admin, body.adminNotes);
  }

  @Post('payments/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending payment request' })
  @ApiParam({ name: 'id', format: 'uuid' })
  rejectPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { rejectionReason: string },
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.rejectPayment(
      id,
      admin,
      body.rejectionReason,
    );
  }

  // ==================== SUBSCRIPTIONS ====================

  @Get('subscriptions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all subscriptions' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', enum: SubscriptionStatus, required: false })
  @ApiQuery({ name: 'search', required: false })
  listSubscriptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: SubscriptionStatus,
    @Query('search') search?: string,
  ) {
    return this.billingAdminService.listAllSubscriptions({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      search,
    });
  }

  @Post('subscriptions/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending subscription' })
  @ApiParam({ name: 'id', format: 'uuid' })
  approveSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.approveSubscription(id, admin);
  }

  @Post('subscriptions/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending subscription' })
  @ApiParam({ name: 'id', format: 'uuid' })
  rejectSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.rejectSubscription(id, admin);
  }

  @Post('subscriptions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an active subscription' })
  @ApiParam({ name: 'id', format: 'uuid' })
  cancelSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.cancelSubscription(id, admin);
  }

  @Post('subscriptions/:id/expire')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a subscription as expired' })
  @ApiParam({ name: 'id', format: 'uuid' })
  expireSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.expireSubscription(id, admin);
  }

  @Post('subscriptions/:id/extend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extend subscription duration by days' })
  @ApiParam({ name: 'id', format: 'uuid' })
  extendSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { days: number },
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.extendSubscription(id, body.days, admin);
  }

  @Post('subscriptions/:id/change-plan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change subscription plan' })
  @ApiParam({ name: 'id', format: 'uuid' })
  changeSubscriptionPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { planCode: string },
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.changeSubscriptionPlan(
      id,
      body.planCode,
      admin,
    );
  }

  // ==================== PLANS ====================

  @Get('plans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all plans (including inactive)' })
  listPlans() {
    return this.billingAdminService.listAllPlansForAdmin();
  }

  @Post('plans')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new plan' })
  createPlan(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string;
      priceMonthlyRwf: number;
      rateLimitPerHour?: number;
      features?: string[];
    },
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.createPlan(body, admin);
  }

  @Patch('plans/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a plan' })
  @ApiParam({ name: 'id', format: 'uuid' })
  updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      priceMonthlyRwf?: number;
      rateLimitPerHour?: number;
      features?: string[];
      isActive?: boolean;
    },
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.updatePlan(id, body, admin);
  }

  @Delete('plans/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a plan' })
  @ApiParam({ name: 'id', format: 'uuid' })
  deletePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.deletePlan(id, admin);
  }

  // ==================== USERS ====================

  @Get('users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false })
  listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.billingAdminService.listAllUsers({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      role,
    });
  }

  @Get('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get full user details' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getUserDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingAdminService.getUserDetails(id);
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend a user and revoke API keys' })
  @ApiParam({ name: 'id', format: 'uuid' })
  suspendUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.suspendUser(id, admin, body.reason);
  }

  @Post('users/:id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a suspended user' })
  @ApiParam({ name: 'id', format: 'uuid' })
  activateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.activateUser(id, admin);
  }

  @Patch('users/:id/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user role' })
  @ApiParam({ name: 'id', format: 'uuid' })
  changeUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { role: string },
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.changeUserRole(id, body.role, admin);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a user account' })
  @ApiParam({ name: 'id', format: 'uuid' })
  deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Admin() admin: JwtPayload,
  ) {
    return this.billingAdminService.deleteUser(id, admin);
  }

  // ==================== AUDIT LOGS ====================

  @Get('audit-logs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List audit logs' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'actorEmail', required: false })
  @ApiQuery({ name: 'targetEmail', required: false })
  listAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('actorEmail') actorEmail?: string,
    @Query('targetEmail') targetEmail?: string,
  ) {
    return this.billingAdminService.listAuditLogs({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      action:
        action && Object.values(AuditAction).includes(action as AuditAction)
          ? (action as AuditAction)
          : undefined,
      actorEmail,
      targetEmail,
    });
  }

  // ==================== NOTIFICATIONS ====================

  @Get('notifications/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List notifications for a user' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'unreadOnly', required: false })
  listNotifications(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.billingAdminService.listNotifications(userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Patch('notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', format: 'uuid' })
  markNotificationRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('userId') userId: string,
  ) {
    return this.billingAdminService.markNotificationRead(id, userId);
  }

  @Get('notifications/:userId/unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get unread notification count for a user' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  getUnreadCount(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.billingAdminService.getUnreadNotificationCount(userId);
  }
}
