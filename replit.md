# Psychological Assessment Platform - replit.md

## Overview
This platform, "Rumah Psikologi Pelangi Indonesia," is a web-based psychological assessment system. It enables users to take validated assessments, manage their history, and generate detailed PDF reports. The project aims to provide accessible psychological assessments like the Sensory Profile and Learning Style Inventory, offering valuable insights and recommendations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application uses a monorepo structure with distinct client, server, and shared components.

**Frontend:**
-   **Framework:** React 18 with TypeScript
-   **Routing:** Wouter
-   **Styling:** Tailwind CSS with shadcn/ui components (Radix UI primitives) for UI, supporting dark mode
-   **State Management:** TanStack Query for server state, Zustand for client-side state (e.g., shopping cart)
-   **Build Tool:** Vite

**Backend:**
-   **Runtime:** Node.js with Express.js
-   **Database:** PostgreSQL (Neon serverless driver)
-   **ORM:** Drizzle ORM for type-safe queries
-   **Authentication:** Custom JWT-based authentication
-   **Session Management:** PostgreSQL-backed sessions
-   **PDF Generation:** PDFKit

**Database Schema:**
Key entities include Users, Assessments, Orders, UserAssessments, and Sessions.

**Assessment Types:**
1.  **Sensory Profile Assessment:** A 125-question assessment focused on sensory processing patterns.
2.  **Learning Style Inventory:** Determines visual, auditory, or kinesthetic learning preferences.

**Key Features:**
-   User authentication and management (including admin roles).
-   Shopping cart and order processing for assessments.
-   Multi-step assessment forms with progress tracking.
-   Server-side generation of detailed PDF reports.
-   Admin dashboard for user, assessment, and report management with CSV/Excel export.
-   Integrated payment gateway for real-time transactions.
-   Real-time data synchronization between the platform and payment gateway.

## External Dependencies

-   **@neondatabase/serverless:** PostgreSQL database connectivity.
-   **drizzle-orm:** Type-safe database ORM.
-   **@tanstack/react-query:** Server state management.
-   **@radix-ui/***: Accessible UI component primitives.
-   **tailwindcss:** Utility-first CSS framework.
-   **wouter:** Lightweight routing library.
-   **zustand:** Minimal state management.
-   **pdfkit:** PDF document generation.
-   **passport:** Authentication middleware.
-   **midtrans-client:** Midtrans payment gateway integration.

## Recent Changes (August 4, 2025)

### Fixed Real-Time Payment Synchronization System

**Problem:** Auto-sync system was failing with 8 pending orders not synchronizing properly - Midtrans API returning 404 errors for payment IDs.

**Root Cause:** Orders were being created without proper Midtrans transaction creation, resulting in payment IDs that don't exist in Midtrans Production environment.

**Solution Implemented:**
1. **Enhanced Payment Creation Process**: Fixed `/api/payments/create` to properly create Midtrans transactions with correct customer details and item information.
2. **Improved Auto-Sync Logic**: Enhanced error handling with aggressive cleanup of orphaned orders (5-minute expiration for 404 errors).
3. **Manual Recovery System**: Created `payment-recovery.ts` for cleaning up problematic pending orders.
4. **Database Cleanup**: Removed 7 expired orders that were causing sync failures.

**Technical Details:**
- Payment ID format: `order_{orderId}_{timestamp}`
- Auto-sync frequency: Every 5 seconds
- Order expiration: 5 minutes for 404 errors, 10 minutes for orders without payment_id
- Production-only Midtrans environment with proper credential validation

**Status:** System now properly creates Midtrans transactions and maintains real-time synchronization between payment gateway and application database.

### Additional Fix (August 4, 2025 - Follow-up)

**Issue Identified:** Auto-sync was only processing single user orders instead of system-wide pending orders.

**Final Solution:**
1. **System-Wide Auto-Sync**: Modified `getAllPendingOrders()` to fetch ALL pending orders from ALL users, not just specific user
2. **Ultra-Aggressive Cleanup**: Reduced cleanup timeout from 5 minutes to 2 minutes for faster response
3. **Complete Database Cleanup**: Manually cleaned all remaining pending orders (228, 230, 231, 232, 235, 236)

**Technical Implementation:**
- Direct SQL queries to fetch system-wide pending orders across all users
- Enhanced logging for better visibility into sync operations
- Improved error handling for 404 responses from Midtrans Production API

**Current Status:** All pending orders cleared, system running clean with 0 pending orders.