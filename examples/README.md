# Next-Limitr Examples

This directory contains example implementations of Next-Limitr in various Next.js contexts.

## Examples

1. `api-routes/` - Examples for using Next-Limitr with API Routes in the Pages Router
2. `edge-middleware/` - Examples for using Next-Limitr with Edge Middleware

## How to Use These Examples

These examples are for illustration purposes. To use them in your Next.js project:

1. Install Next-Limitr in your project:
   ```bash
   npm install next-limitr
   ```

2. Copy the relevant examples to your project structure:
   - API Routes examples go in your `/pages/api/` directory
   - Edge Middleware examples go in your project root (as `middleware.ts`)

3. Customize the rate limiting options to suit your needs

## Notes on Examples

- The imports in these examples may show linting errors in this repository as they reference the package by name (`next-limitr`), but they will work correctly when used in an actual Next.js project with the package installed.
- These examples demonstrate basic usage. See the main documentation for advanced configuration options. 