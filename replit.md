# Psychological Assessment Platform - Replit.md

## Overview

This is a comprehensive web-based psychological assessment platform called "Rumah Psikologi Indonesia" built with a modern full-stack architecture. The platform enables users to take validated psychological assessments, manage their assessment history, and generate detailed PDF reports. The application supports multiple assessment types including Sensory Profile and Learning Style Inventory assessments.

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
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```