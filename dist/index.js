"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
// Importa o router padrão das rotas de autenticação
const auth_1 = __importDefault(require("./routes/auth"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Routes
app.use('/api/auth', auth_1.default);
// Health check for orchestration/monitoring tools
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});
// Error handling
app.use((err, req, res, next) => {
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
const shutdown = (signal) => {
    if (isShuttingDown) {
        console.log(`Shutdown already in progress (signal: ${signal}).`);
        return;
    }
    isShuttingDown = true;
    console.log(`Received ${signal}, shutting down gracefully...`);
    server.close((err) => {
        if (err) {
            console.error('Error closing HTTP server:', err);
            process.exitCode = 1;
        }
        else {
            console.log('HTTP server closed. Goodbye!');
            process.exitCode = 0;
        }
        process.exit();
    });
    // Forcibly exit if shutdown takes too long
    setTimeout(() => {
        console.warn('Forcing shutdown after timeout.');
        process.exit(1);
    }, 10000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
exports.default = app;
//# sourceMappingURL=index.js.map