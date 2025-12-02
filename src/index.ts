import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
// Importa o router padrão das rotas de autenticação
import authRoutes from './routes/auth';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);

// Health check for orchestration/monitoring tools
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 SERPRO Authentication API running on port ${PORT}`);
  console.log(`🔐 Authentication: http://localhost:${PORT}/api/auth/serpro`);
  console.log(`🧪 Supabase Test: http://localhost:${PORT}/api/auth/test-supabase`);
});

/**
 * Handle termination signals gracefully so container orchestrators (Docker, etc.)
 * don't leave npm reporting a SIGTERM error. Closing the HTTP server before
 * exiting avoids abrupt termination messages in the logs.
 */
let isShuttingDown = false;
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10_000;

const shutdown = (signal: NodeJS.Signals) => {
  if (isShuttingDown) {
    console.log(`Shutdown already in progress (signal: ${signal}).`);
    return;
  }

  isShuttingDown = true;
  console.log(`Received ${signal}, shutting down gracefully...`);

  const shutdownTimer = setTimeout(() => {
    console.warn('Forcing shutdown after timeout.');
    process.exit(1);
  }, GRACEFUL_SHUTDOWN_TIMEOUT_MS).unref();

  server.close((err) => {
    clearTimeout(shutdownTimer);

    if (err) {
      console.error('Error closing HTTP server:', err);
      process.exit(1);
      return;
    }

    console.log('HTTP server closed. Goodbye!');
    process.exit(0);
  });
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

export default app;
