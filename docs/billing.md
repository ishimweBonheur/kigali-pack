# Billing & Subscription Management

## Overview

Kigali-Pack Cloud Engine billing system supports **manual payment processing** managed by administrators. This architecture was designed to support future automatic payment providers (MTN Mobile Money, Flutterwave, Paystack) without changing the core billing system.

## Architecture

```
src/modules/billing/
├── billing.controller.ts        # User-facing billing endpoints
├── billing.service.ts           # Core billing logic (plans, subscriptions, invoices)
├── billing-admin.controller.ts  # Admin-facing management endpoints
├── billing-admin.service.ts     # Admin management logic (payments, users, audits)
├── billing.module.ts            # Module registration
├── dto/                         # Data transfer objects
├── entities/                    # TypeORM entities
│   ├── plan.entity.ts
│   ├── subscription.entity.ts
│   ├── invoice.entity.ts
│   ├── payment-request.entity.ts
│   ├── audit-log.entity.ts
│   └── notification.entity.ts
├── guards/
│   └── subscription.guard.ts    # API access control guard
└── interfaces/
    └── payment-provider.interface.ts  # Payment abstraction layer
```

## Database Models

### Plans (`billing_plans`)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| code | VARCHAR(50) | Unique plan code (FREE, PRO, ENTERPRISE) |
| name | VARCHAR(100) | Display name |
| description | TEXT | Plan description |
| priceMonthlyRwf | DECIMAL(12,2) | Monthly price in RWF |
| rateLimitPerHour | INTEGER | API rate limit per hour |
| features | JSONB | Array of feature strings |
| isActive | BOOLEAN | Whether plan is available |
| createdAt | TIMESTAMPTZ | Creation timestamp |

### Subscriptions (`billing_subscriptions`)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| developerName | VARCHAR(255) | Organization slug |
| planId | UUID | Foreign key to plan |
| status | VARCHAR(30) | PENDING, ACTIVE, REJECTED, EXPIRED, CANCELLED, PAST_DUE |
| currentPeriodStart | TIMESTAMPTZ | Subscription period start |
| currentPeriodEnd | TIMESTAMPTZ | Subscription period end |
| cancelledAt | TIMESTAMPTZ | When cancelled |
| createdAt | TIMESTAMPTZ | Creation timestamp |

### Payment Requests (`payment_requests`)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | User who submitted |
| userEmail | VARCHAR(255) | User email |
| subscriptionId | UUID | Related subscription (nullable) |
| planName | VARCHAR(100) | Plan name at time of request |
| amount | DECIMAL(12,2) | Payment amount |
| currency | VARCHAR(10) | Currency (default: RWF) |
| paymentMethod | VARCHAR(50) | Payment method used |
| transactionReference | VARCHAR(255) | Reference number |
| paymentProof | TEXT | Payment proof URL/text |
| notes | TEXT | User notes |
| status | VARCHAR(30) | PENDING, APPROVED, REJECTED |
| rejectionReason | TEXT | Reason if rejected |
| reviewedBy | UUID | Admin who reviewed |
| reviewedAt | TIMESTAMPTZ | Review timestamp |

### Audit Logs (`audit_logs`)
Tracks all admin actions including:
- Payment approvals/rejections
- Subscription changes
- Plan creation/deletion
- User suspension/activation
- Role changes

### Notifications (`notifications`)
User notifications for:
- Payment submitted
- Payment approved/rejected
- Subscription activated/expiring/expired
- Plan changes

## User Subscription Flow

1. **View Plans** → User browses available plans at `/v1/billing/plans`
2. **Submit Payment Request** → User submits payment information/proof
3. **Status: PENDING** → Payment request enters review queue
4. **Admin Reviews** → Admin views payment details at admin dashboard
5. **Admin Approves** → System automatically:
   - Changes payment status to APPROVED
   - Activates subscription with expiration date
   - Creates invoice (PAID status)
   - Updates API key tier
   - Creates audit log entry
   - Notifies user
6. **Admin Rejects** → System:
   - Changes payment status to REJECTED
   - Requires rejection reason
   - Notifies user with reason

## Admin Management

### API Endpoints

All admin endpoints require `AdminGuard` (MASTER_ADMIN, ADMIN, OWNER, ORG_OWNER roles).

#### Dashboard
- `GET /v1/admin/billing/dashboard` - Billing statistics

#### Payments
- `GET /v1/admin/billing/payments` - List payment requests
- `GET /v1/admin/billing/payments/:id` - Get payment details
- `POST /v1/admin/billing/payments/:id/approve` - Approve payment
- `POST /v1/admin/billing/payments/:id/reject` - Reject payment

#### Subscriptions
- `GET /v1/admin/billing/subscriptions` - List all subscriptions
- `POST /v1/admin/billing/subscriptions/:id/approve` - Approve subscription
- `POST /v1/admin/billing/subscriptions/:id/reject` - Reject subscription
- `POST /v1/admin/billing/subscriptions/:id/cancel` - Cancel subscription
- `POST /v1/admin/billing/subscriptions/:id/expire` - Mark as expired
- `POST /v1/admin/billing/subscriptions/:id/extend` - Extend duration
- `POST /v1/admin/billing/subscriptions/:id/change-plan` - Change plan

#### Plans
- `GET /v1/admin/billing/plans` - List all plans
- `POST /v1/admin/billing/plans` - Create plan
- `PATCH /v1/admin/billing/plans/:id` - Update plan
- `DELETE /v1/admin/billing/plans/:id` - Delete plan

#### Users
- `GET /v1/admin/billing/users` - List users
- `GET /v1/admin/billing/users/:id` - User details
- `POST /v1/admin/billing/users/:id/suspend` - Suspend user
- `POST /v1/admin/billing/users/:id/activate` - Activate user
- `PATCH /v1/admin/billing/users/:id/role` - Change role
- `DELETE /v1/admin/billing/users/:id` - Delete user

#### Audit Logs
- `GET /v1/admin/billing/audit-logs` - List audit logs

## API Access Control

The `SubscriptionGuard` can be applied to any protected route to verify:

1. API key validity
2. Subscription status (must be ACTIVE)
3. Subscription expiration

If subscription is expired, returns:
```json
{
  "success": false,
  "error": {
    "code": "SUBSCRIPTION_REQUIRED",
    "message": "Your subscription has expired. Please renew your plan."
  }
}
```

## Payment Provider Abstraction

The `PaymentProvider` interface in `src/modules/billing/interfaces/` provides a contract for implementing payment providers:

```typescript
interface PaymentProvider {
  name: string;
  createPayment(amount, currency, metadata): CreatePaymentResult;
  verifyPayment(reference): VerifyPaymentResult;
  refundPayment(reference, amount?, reason?): RefundPaymentResult;
}
```

To add a new provider, create a class that implements `PaymentProvider` and register it in the billing module.

## Default Plans

| Plan | Code | Price (RWF) | Rate Limit/hr | Features |
|------|------|-------------|---------------|----------|
| Free | FREE | 0 | 100 | Basic API access, 5 API keys |
| Developer | DEVELOPER | 29,000 | 1,000 | Advanced features, 20 API keys |
| Business | BUSINESS | 99,000 | 10,000 | Full features, unlimited API keys |
| Enterprise | ENTERPRISE | 299,000 | 50,000 | Custom features, priority support |

## Running Migrations

```bash
# Run all pending migrations
npx typeorm migration:run -d src/database/data-source.ts

# Revert last migration
npx typeorm migration:revert -d src/database/data-source.ts