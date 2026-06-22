<p align="center">
  <a href="https://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<h1 align="center">Kigali-Pack Cloud Engine</h1>

<p align="center">
  A high-performance, production-grade B2B SaaS Cloud Infrastructure Engine built on <a href="http://nestjs.com/" target="_blank">NestJS</a>. Purpose-built to eliminate infrastructure fragmentation for software development teams building digital products in Rwanda.
</p>

<p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://github.com/nestjs/nest/blob/master/LICENSE" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
</p>

---

## 🚀 Core Engine Capabilities

The **Kigali-Pack Cloud Engine** provides a comprehensive ecosystem of localized APIs, sandboxes, and utilities that enable engineering teams to prototype and launch production systems inside Rwanda rapidly.

### Key Architecture Features:
* **📍 5-Tier Location Hierarchy:** Immutable database graph containing all Provinces, Districts, Sectors, Cells, and Villages in Rwanda with built-in address normalization.
* **💳 Core Mobile Money Sandboxes:** Dynamic testing blocks simulating MTN MoMo and Airtel Money charge collection flows, payment records, and status triggers.
* **🔒 Dynamic NIDA KYC Compliance:** Secure structural verification for 16-digit National IDs mapping context-aware developer profile metadata on the sandbox layer.
* **📊 Progressive RRA Tax Calculations:** Complete statutory calculation engine computing payroll PAYE brackets, RSSB deductions, and standard 18% VAT breakdowns.
* **🛡️ Dual-Token Authentication:** Built-in isolation separating human management tasks via **JWT Tenant RBAC** and automated system actions via **Developer API Keys** (`kp_test_...` / `kp_live_...`).
* **📈 Global Telemetry & PII Masking:** Asynchronous request/response interceptors calculating execution times in milliseconds while cryptographically masking sensitive client data.

---

## 🛠️ Unified API Endpoint Directory

### 🏥 System Health
| Method | Endpoint | Description | Auth Mode |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Full system health status matrix check | Public |
| `GET` | `/ready` | Application Readiness check probe | Public |
| `GET` | `/live` | Core runtime Liveness status probe | Public |
| `GET` | `/version` | System application semantic version metadata | Public |

### 🔐 Authentication & Onboarding
| Method | Endpoint | Description | Auth Mode |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/auth/register` | Register a new organization and master owner account | Public |
| `POST` | `/v1/auth/login` | Authenticate profile to claim JWT Access + Refresh tokens | Public |
| `POST` | `/v1/auth/refresh` | Issue a new Access Token using a valid Refresh Token | Public |
| `POST` | `/v1/auth/logout` | Revoke a refresh token and invalidate active dashboard state | Public |
| `POST` | `/v1/auth/forgot-password` | Generate a secure password reset link token verification flow | Public |
| `POST` | `/v1/auth/reset-password` | Validate action token and process user password update | Public |
| `POST` | `/v1/auth/verify-email` | Mark an organization owner's profile `emailVerified = true` | Public |

### 👤 Profile Management
| Method | Endpoint | Description | Auth Mode |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/me` | Fetch authenticated member organization profile | JWT |
| `PATCH` | `/v1/me` | Update authenticated member account properties | JWT |
| `DELETE` | `/v1/me` | Permanently delete active developer member account | JWT |

### 📍 National Geographic Locations
| Method | Endpoint | Description | Auth Mode |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/locations/root-provinces` | Retrieve a list of all active root Provinces | API Key |
| `GET` | `/v1/locations/{parentId}/children` | Fetch child sub-units by parent ID (RESTful hierarchy) | API Key |
| `POST` | `/v1/locations/normalize` | Normalize raw text strings against the official NISR database | API Key |

### 💳 Sandbox Cellular Payments
| Method | Endpoint | Description | Auth Mode |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/sandbox/payments/charge` | Trigger a mock MTN MoMo or Airtel Money payment pull | API Key |
| `POST` | `/v1/sandbox/payments/webhook/simulate` | Fire a mock event delivery to a user's local server tunnel | API Key |
| `GET` | `/v1/sandbox/payments/test-accounts` | List simulation numbers and balance action triggers | API Key |
| `GET` | `/v1/sandbox/payments/history` | List payment transaction logs with filtering and sorting | API Key |
| `GET` | `/v1/sandbox/payments/history/{id}` | Query a single transaction payload state by its unique ID | API Key |
| `GET` | `/v1/sandbox/payments/status/{transactionId}` | Check real-time payment settlement or rejection flags | API Key |

### 🇷🇼 Statutory Compliance Tools
| Method | Endpoint | Description | Auth Mode |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/compliance/nida/mock/{nationalId}` | Execute structural 16-digit ID validation sandbox checks | API Key |
| `POST` | `/v1/compliance/rra/taxes` | Compute progressive RRA PAYE brackets and 18% VAT streams | API Key |
| `POST` | `/v1/compliance/rra/rssb` | Compute statutory employee and employer RSSB deductions | API Key |
| `POST` | `/v1/compliance/rra/payroll-summary` | Get unified line-item calculations (Gross $\rightarrow$ Net Pay) | API Key |
| `GET` | `/v1/compliance/boilerplates/scaffold` | Retrieve recommended software integration template stacks | API Key |

### 🔑 Developer Workspace & Key Controls
| Method | Endpoint | Description | Auth Mode |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/developer/workspace/complete-core-snapshot` | Fetch aggregate map metadata and analytics summaries | API Key |
| `POST` | `/v1/developer/api-keys` | Provision a new functional security API key token | JWT |
| `GET` | `/v1/developer/api-keys` | List active keys owned by the authenticated developer | JWT |
| `PATCH` | `/v1/developer/api-keys/{id}/revoke` | Revoke token permanently to kill traffic routing | JWT |
| `POST` | `/v1/developer/api-keys/{id}/rotate` | Rotate an active API token while keeping profile details intact | JWT |

### 📊 Metric Telemetry & Real-Time Analytics
| Method | Endpoint | Description | Auth Mode |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/developer/analytics/summary` | Get aggregated dashboard execution summaries | API Key |
| `GET` | `/v1/developer/analytics/usage` | Fetch month-to-date total traffic volume statistics | API Key |
| `GET` | `/v1/developer/analytics/errors` | Access active route error rates and tracking alerts | API Key |
| `GET` | `/v1/developer/analytics/latency` | Audit network response delays across controllers | API Key |
| `GET` | `/v1/developer/analytics/endpoints` | Review volume allocation map grouped per individual route | API Key |
| `GET` | `/v1/developer/analytics/logs` | Fetch paginated historical audit trails of system logs | API Key |
| `GET` | `/v1/developer/analytics/logs/{id}` | Access raw payload details for debugging a runtime crash | API Key |

### 🪝 Outbound Developer Webhooks
| Method | Endpoint | Description | Auth Mode |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/developer/webhooks` | Register an external server endpoint callback URL | API Key |
| `GET` | `/v1/developer/webhooks` | List webhook instances registered under the active key | API Key |
| `PATCH` | `/v1/developer/webhooks/{id}` | Modify callback endpoints or retry configuration parameters | API Key |
| `DELETE` | `/v1/developer/webhooks/{id}` | Remove a webhook handler from the event dispatcher engine | API Key |
| `GET` | `/v1/developer/webhooks/{id}/deliveries` | Audit event histories and external server reply statuses | API Key |
| `POST` | `/v1/developer/webhooks/{id}/test` | Fire a sample signed test payload to verify handshake links | API Key |
| `POST` | `/v1/developer/webhooks/deliveries/{id}/retry` | Replay a failed event attempt manually with new tracking | API Key |

### 🧾 B2B SaaS Billing & Invoicing
| Method | Endpoint | Description | Auth Mode |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/billing/plans` | List commercially available pricing plan tiers | Public |
| `GET` | `/v1/billing/subscriptions/current` | Review current account tier capabilities and caps | JWT |
| `POST` | `/v1/billing/subscriptions` | Upgrade account profile to an active premium subscription | JWT |
| `DELETE` | `/v1/billing/subscriptions/current` | Deactivate auto-renewal cycles for the organization | JWT |
| `GET` | `/v1/billing/invoices` | List billing statement details and monthly history lists | JWT |
| `GET` | `/v1/billing/invoices/{id}` | Retrieve individual financial receipts or statement payloads | JWT |
| `GET` | `/v1/billing/usage-counter` | Check precise volume consumption versus subscription limits | JWT |

### 👥 Teams, Organizations, & RBAC Roles
| Method | Endpoint | Description | Auth Mode |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/organizations` | Provision an independent organization cluster instance | JWT |
| `GET` | `/v1/organizations` | List multi-tenant clusters matching the authenticated member | JWT |
| `POST` | `/v1/organizations/{id}/members` | Invite a remote engineering account into your workspace team | JWT |
| `GET` | `/v1/organizations/{id}/members` | Audit teammate list structures and active access levels | JWT |
| `DELETE` | `/v1/organizations/{id}/members/{memberId}` | Remove an engineer's role privileges from the workplace | JWT |

### 🛠️ Phone & Profile Test Utilities
| Method | Endpoint | Description | Auth Mode |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/utilities/phone/validate` | Verify structural rules for cell contacts (+250) | API Key |
| `GET` | `/v1/utilities/phone/carrier` | Intercept string prefixes to isolate MTN vs Airtel numbers | API Key |
| `GET` | `/v1/utilities/phone/format` | Clean or reformat local contacts into standard E.164 styles | API Key |
| `GET` | `/v1/utilities/citizens/random` | Generate synthetic citizen records for database testing | API Key |
| `GET` | `/v1/utilities/addresses/random` | Generate randomized, syntactically correct Rwandan locations | API Key |

---

## 🛠️ Project Setup & Installation

Make sure you have **Node.js (v18+)** and a **PostgreSQL** server running locally.

### 1. Install Dependencies
```bash
$ npm install