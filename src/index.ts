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
const shutdown = (signal: NodeJS.Signals) => {
  console.log(`Received ${signal}, shutting down gracefully...`);

  server.close(() => {
    console.log('HTTP server closed. Goodbye!');
    process.exit(0);
  });

  // Forcibly exit if shutdown takes too long
  setTimeout(() => {
    console.warn('Forcing shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
