# Psychological Assessment Platform - Replit.md

## Overview

This is a comprehensive web-based psychological assessment platform called "Rumah Psikologi Pelangi Indonesia" built with a modern full-stack architecture. The platform enables users to take validated psychological assessments, manage their assessment history, and generate detailed PDF reports. The application supports multiple assessment types including Sensory Profile and Learning Style Inventory assessments.

## System Architecture

The application follows a monorepo structure with clear separation between client, server, and shared components:

- **Frontend**: React with TypeScript using Vite as the build tool
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Replit-based OIDC authentication system
- **UI Framework**: shadcn/ui components built on Radix UI primitives with Tailwind CSS styling
- **State Management**: Zustand for cart management, TanStack Query for server state

## Key Components

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with CSS variables for theming
- **UI Components**: shadcn/ui component library with dark mode support
- **State Management**: 
  - TanStack Query for server state and caching
  - Zustand with persistence for shopping cart
- **Build Tool**: Vite with custom configuration for development and production

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM for type-safe database queries
- **Authentication**: Passport.js with OpenID Connect strategy for Replit authentication
- **Session Management**: PostgreSQL-backed sessions with connect-pg-simple
- **PDF Generation**: PDFKit for assessment report generation

### Database Schema
The database uses PostgreSQL with the following key entities:
- **Users**: Authentication and profile information
- **Assessments**: Assessment definitions and metadata
- **Orders**: Purchase transactions with items
- **UserAssessments**: Individual assessment instances with results
- **Sessions**: Authentication session storage

### Assessment Types
1. **Sensory Profile Assessment**: 125-question assessment evaluating sensory processing patterns
2. **Learning Style Inventory**: Assessment determining visual, auditory, or kinesthetic learning preferences

## Data Flow

1. **User Authentication**: OIDC-based authentication through Replit
2. **Assessment Purchase**: Shopping cart → Order creation → Demo payment processing
3. **Assessment Taking**: Multi-step forms with progress tracking and auto-save
4. **Results Processing**: Scoring algorithms generate interpretive reports
5. **PDF Generation**: Server-side PDF creation with assessment results and recommendations

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Accessible UI component primitives
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Lightweight routing library
- **zustand**: Minimal state management
- **pdfkit**: PDF document generation
- **passport**: Authentication middleware

### Development Dependencies
- **vite**: Fast build tool and dev server
- **typescript**: Type safety and enhanced developer experience
- **@replit/vite-plugin-***: Replit-specific development tools

## Deployment Strategy

The application is configured for deployment on Replit with:
- **Development**: `npm run dev` - Runs TSX with hot reload
- **Production Build**: `npm run build` - Vite build + esbuild bundle for server
- **Production Start**: `npm start` - Runs compiled server bundle
- **Database Migrations**: `npm run db:push` - Drizzle schema sync

### Environment Requirements
- `DATABASE_URL`: PostgreSQL connection string (Neon compatible)
- `SESSION_SECRET`: Session encryption key
- `REPL_ID`: Replit environment identifier
- `ISSUER_URL`: OIDC issuer URL (defaults to Replit)

### Build Configuration
- Client builds to `dist/public` for static asset serving
- Server bundles to `dist/index.js` with ESM format
- Vite handles client-side bundling with React Fast Refresh
- esbuild handles server-side bundling for production

## Changelog

```
Changelog:
- July 02, 2025. Initial setup
- July 05, 2025. Removed email verification with OTP completely
- July 05, 2025. Removed Replit authentication system entirely
- July 05, 2025. Implemented custom JWT-based authentication
- July 05, 2025. Registration now automatically verifies users and logs them in
- July 05, 2025. Database cleared for fresh testing
- July 05, 2025. Fixed assessment progress saving - JWT authentication now properly handles save-progress functionality
- July 05, 2025. All authentication URLs corrected from /api/login to /login
- July 05, 2025. Assessment progress persistence fully functional
- July 05, 2025. Fixed PDF download functionality for all assessments
- July 05, 2025. Implemented proper result calculation for both Sensory Profile and Learning Style assessments
- July 05, 2025. Updated PDF generation to use correct data structure (primaryStyle instead of dominantStyle)
- July 05, 2025. All PDF downloads now working with proper JWT authentication
- July 05, 2025. Fixed forgot password page routing - added missing /forgot-password route
- July 05, 2025. Fixed login form issue - "Lupa password?" button now has proper type="button" attribute
- July 05, 2025. Database cleared for clean testing environment
- July 05, 2025. Fixed Inventori Gaya Belajar assessment completion error
- July 05, 2025. Added support for different data formats in completion endpoint (results vs responses/participantInfo)
- July 05, 2025. Assessment completion now handles both sensory profile and learning style assessment data structures
- July 05, 2025. Fixed learning style assessment results display - updated field names from scores/dominantStyle to styleScores/primaryStyle
- July 05, 2025. Assessment results page now properly handles new data structure with backward compatibility
- July 05, 2025. Fixed Sensory Profile assessment results display error - resolved "Objects are not valid as a React child" error
- July 05, 2025. Improved section score display to show total and average values for sensory profile results
- July 05, 2025. Fixed "score.average.toFixed is not a function" error by adding proper type checking and conversion
- July 06, 2025. Created comprehensive admin system with login, dashboard, user management, and assessment management
- July 06, 2025. Added admin role and user activation fields to database schema
- July 06, 2025. Implemented admin authentication with JWT tokens and role-based access control
- July 06, 2025. Created admin dashboard with real-time statistics and navigation
- July 06, 2025. Added admin user management with user activation, role management, and password reset
- July 06, 2025. Implemented admin assessment management with filtering and PDF export capabilities
- July 06, 2025. Fixed critical admin authentication bug - apiRequest was returning Response object instead of parsed JSON
- July 06, 2025. Added React Query cache invalidation and proper token validation for admin dashboard
- July 06, 2025. Cleared all test data for clean testing environment - only admin user remains
- July 06, 2025. Fixed PDF generation for Sensory Profile assessments - resolved "undefined" interpretation and "[object Object]" section scores
- July 06, 2025. Updated PDF generator to handle new sectionScores data structure with {total, count, average} objects
- July 06, 2025. Added proper interpretation generation fallback when interpretation is missing from results
- July 06, 2025. Fixed admin dashboard user management - lastLoginAt now updates correctly for both admin and regular users
- July 06, 2025. Fixed admin assessments page - user names now display properly by including user data in getAllUserAssessments query
- July 06, 2025. Created admin reports page with comprehensive analytics and statistics
- July 06, 2025. Implemented working CSV export functionality for admin assessments data
- July 06, 2025. Added WhatsApp column to admin assessments page - displays user WhatsApp numbers in table and CSV export
- July 06, 2025. Fixed admin reports page analytics - Assessment Type Analysis and Recent Activity now show real data
- July 06, 2025. Implemented working Excel/CSV export functionality for admin reports with comprehensive analytics data
- July 06, 2025. Updated UserAssessmentWithDetails schema to include whatsappNumber field for proper data display
- July 06, 2025. Fixed admin assessment view results and PDF download functionality - created admin-specific routes and pages
- July 06, 2025. Added admin assessment result page with proper authentication and data display
- July 06, 2025. Created admin-specific API endpoints for viewing assessment results and downloading PDFs
- July 06, 2025. Fixed admin reports page PDF export functionality with working CSV download
- July 06, 2025. Fixed revenue calculation in admin reports - now uses actual assessment prices (Sensory Profile: Rp 400,000, Learning Style: Rp 200,000)
- July 06, 2025. Updated backend getAssessmentStats to provide real assessment type statistics instead of hardcoded percentages
- July 06, 2025. Admin reports Analytics now shows accurate revenue data per assessment type based on actual completed assessments
- July 09, 2025. Completed comprehensive branding update to "Rumah Psikologi Pelangi Indonesia" across all components (PDF reports, email templates, and system references)
- July 09, 2025. Fixed PDF footer to use correct company name "Rumah Psikologi Pelangi Indonesia" instead of "Rumah Psikologi Indonesia"
- July 09, 2025. Integrated company logo throughout entire platform (website header, footer, landing page, admin pages, and PDF reports)
- July 09, 2025. Fixed critical PDF generation bug - resolved __dirname issue by using process.cwd() for ES modules compatibility
- July 09, 2025. PDF downloads now working correctly for both Sensory Profile and Learning Style assessments with logo integration
- July 09, 2025. Fixed logo positioning in PDF reports - adjusted Y coordinates to prevent text overlap and ensure proper spacing
- July 09, 2025. Improved PDF layout spacing - set logo at Y=60 and title text at Y=150 for proper visual separation
- July 09, 2025. Final logo positioning fix - moved logo to top-left corner (50, 50) to completely eliminate text overlap
- July 09, 2025. Made Learning Style Inventory assessment free with "Free Access" label - updated database price to 0.00 and UI components to show free access instead of pricing
- July 09, 2025. Added "Gratis Konsultasi Online 1 Kali" benefit label to Sensory Profile assessment across all components (assessment cards, cart page, and shopping cart sidebar)
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```