# MsgRouter Platform - Product Requirements Document

## Original Problem Statement
Build an enterprise HL7 message routing platform with:
1. Configuration & Settings (Admin View) - Manage environments, tenants, message templates
2. Main Workflow (User View) - Multi-step wizard for sending HL7 messages
3. JWT Authentication with Admin/User roles
4. Real HTTP integration for sending messages

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI + Recharts
- **Backend**: Node.js Express with MongoDB native driver (Rewritten from Python FastAPI on Apr 2, 2026)
- **Database**: MongoDB
- **Authentication**: JWT with bcrypt password hashing

## User Personas
1. **Admin**: Full access - manage environments, tenants, templates, users; send messages
2. **User**: Limited access - view dashboard, send messages only

## Core Requirements (Static)
- Environment management with name, URL address, and color
- Tenant management with parent environment relationship and custom port
- Message template management with placeholders (MRN, Visit Number, Room, Bed, Floor, Timestamp, Message ID)
- Multi-step wizard: Scope Selection → Data Input → Review & Send
- Message editing capability before sending
- Audit trail with filtering and search
- Real HTTP POST to configured endpoints

## What's Been Implemented

### Phase 1 (Feb 23, 2026)
- [x] JWT Authentication with Admin/User roles
- [x] Dashboard with 8 stat cards, quick overview, audit trail
- [x] Settings modal with 3 tabs (Environments, Tenants, Templates)
- [x] 14 pre-seeded environments (DEV, QA-EUS, QC, UAT, Weekly, Nightly, Beta, Smoke, etc.)
- [x] Environment CRUD with color picker
- [x] Tenant CRUD with parent environment and port configuration
- [x] Template CRUD with placeholder insertion buttons
- [x] 3-step Send Message wizard with cascading dropdowns
- [x] Message preview with placeholder highlighting
- [x] Message editing before sending
- [x] Real HTTP POST to configured endpoints (with timeout handling)
- [x] Audit log recording for all send attempts
- [x] User management page (Admin only)
- [x] Responsive sidebar navigation
- [x] Toast notifications with Sonner

### Phase 3 (Apr 2, 2026)
- [x] **Complete Backend Rewrite from Python to Node.js**
  - Migrated all API routes from FastAPI to Express.js
  - Migrated from Motor (async MongoDB) to native MongoDB driver
  - All endpoints maintain exact same API contract
  - JWT authentication ported to jsonwebtoken library
  - Password hashing ported to bcryptjs
  - HTTP message sending ported to native fetch API
  - 31/31 backend tests passing
  - 18/18 frontend tests passing
  - Full end-to-end compatibility verified

### Phase 2 (Mar 16, 2026)
- [x] Dashboard Analytics Charts (Recharts):
  - Message Volume (Last 7 Days) - Area chart
  - Messages by Environment - Pie chart
  - Top Tenants by Activity - Horizontal bar chart
- [x] Reprocess Messages Feature:
  - View message details dialog
  - Reprocess individual messages
  - Expandable audit trail rows
- [x] Bulk Reprocess Feature:
  - Checkbox selection for audit entries
  - Select All checkbox
  - Bulk reprocess multiple messages at once
- [x] Message Scheduling:
  - Schedule toggle in Step 3 of wizard
  - Date and Time pickers
  - Scheduled Messages page to view/manage
  - Process Due Messages button
  - Cancel scheduled messages
- [x] Removed user self-registration (admin only can create users)
- [x] Fixed port input field in tenant management

## Supported HL7 Message Types
- ADT: A01, A02, A03, A06, A07, A08, A11, A12, A13, A20, A28, A29, A36, A45
- ORU: R01
- ORM: O01
- SIU: S12, S13, S14, S15
- RAS: O17
- RDE: O11
- MFN: M02
- PPR: PC1, PC2, PC3

## Pre-configured Environments
| Environment | Address |
|------------|---------|
| DEV | https://4.175.139.29:18443 |
| QA-EUS | https://20.15.35.115:28443 |
| QC | https://98.64.161.224:18443 |
| UAT | https://132.196.155.76:18443 |
| Weekly | https://52.185.25.146:18443 |
| Nightly | https://52.238.254.228:18443 |
| Beta | https://64.236.63.100:18443 |
| Smoke | https://172.169.195.36:18443 |
| LT/BP Instance 1 | https://64.236.107.150:18443 |
| LT/BP Instance 2 | https://64.236.107.150:18444 |
| Preprod-HA Instance 1 | https://20.37.140.72:18443 |
| Prod UAE | https://20.174.61.216:18443 |
| Prod Instance 1 | https://52.230.219.206:28443 |
| Prod Instance 2 | https://52.230.219.206:28444 |

## Prioritized Backlog

### P0 (Critical) - Completed
- [x] Authentication system
- [x] Environment/Tenant/Template CRUD
- [x] Message sending workflow
- [x] Audit logging

### P1 (High Priority) - Completed
- [x] Bulk message reprocessing
- [x] Message scheduling/queue
- [x] Dashboard analytics charts
- [x] Message retry functionality

### P2 (Medium Priority) - Next
- [ ] Export audit logs to CSV
- [ ] Template versioning
- [ ] Webhook notifications on failures
- [ ] Email notifications on failures
- [ ] Bulk tenant/template import from CSV

## Next Tasks
1. Add export audit logs to CSV functionality
2. Implement webhook notifications for failed messages
3. Add template versioning/history
4. Implement cron job for automatic scheduled message processing
