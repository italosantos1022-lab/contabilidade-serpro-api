# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a Node.js/TypeScript API for SERPRO authentication using P12 certificates. The API handles authentication requests by downloading P12 certificates from URLs, validating them, and making authenticated requests to SERPRO's API endpoints.

## Common Development Commands

### Development
- `npm run dev` - Start development server with nodemon and live reload
- `npm run build` - Compile TypeScript to JavaScript (output in `/dist`)
- `npm start` - Start production server from compiled JavaScript
- `npm test` - Run tests (currently no tests configured)

### Database
Execute SQL scripts in Supabase:
- `database/schema.sql` - Initial database schema
- `database/schema-atualizado.sql` - Updated schema with SERPRO fields

## Architecture

### Core Structure
```
src/
├── config/supabase.ts    # Supabase client configuration
├── routes/auth.ts        # Authentication routes and P12 certificate handling
└── index.ts             # Express server setup and middleware
```

### Database Design
The application uses Supabase with three main tables:
- `empresas` - Companies with SERPRO credentials and P12 certificate links
- `clientes` - Clients belonging to companies
- `clientes_numeros` - Client contact numbers and responsible persons

### SERPRO Integration
The main authentication flow (`POST /api/auth/serpro`):
1. Validates `idEmpresa` and `idNumero` parameters
2. Queries database for client number → client → company relationship
3. Downloads P12 certificate from company's `link_certificado_p12` URL
4. Creates HTTPS agent with P12 certificate and passphrase
5. Makes authenticated request to SERPRO API with Basic Auth headers
6. Stores returned tokens (`serpro_bearer`, `serpro_jwt`) in company record

### P12 Certificate Handling
The application uses multiple fallback strategies for P12 certificates:
1. Direct pfx approach with Node.js HTTPS Agent
2. node-forge extraction of cert/key pairs
3. Simplified pfx approach with additional TLS options

### Environment Variables
Required in `.env`:
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

## Key Dependencies
- **express** - Web framework
- **axios** - HTTP client with HTTPS agent support for P12 certificates
- **node-forge** - P12 certificate parsing and key extraction
- **@supabase/supabase-js** - Database client
- **multer** - File upload handling
- **helmet/cors** - Security middleware

## API Endpoints
- `POST /api/auth/serpro` - Main SERPRO authentication endpoint
- `GET /api/auth/test-supabase` - Database connection test endpoint

## Development Notes
- The application handles P12 certificate downloads from external URLs
- Certificates are processed in memory and not stored locally
- HTTPS agents are configured with `rejectUnauthorized: false` for development
- Extensive error handling and logging for certificate processing
- Database queries follow the relationship: empresa → cliente → cliente_numero