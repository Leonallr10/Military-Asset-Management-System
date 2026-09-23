import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { purchasesRouter } from './routes/purchases.js';
import { transfersRouter } from './routes/transfers.js';
import { assignmentsRouter } from './routes/assignments.js';
import { expendituresRouter } from './routes/expenditures.js';
import { basesRouter } from './routes/bases.js';
import { assetsRouter } from './routes/assets.js';
import { auditRouter } from './routes/audit.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const allowedOrigins = (
  process.env.CLIENT_ORIGIN ||
  'http://localhost:5173,http://localhost:5174'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (curl, server-to-server) with no Origin
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes('*') ||
        /^https:\/\/.*\.vercel\.app$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mams-api' });
});

app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/transfers', transfersRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/expenditures', expendituresRouter);
app.use('/api/bases', basesRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/audit', auditRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`MAMS API listening on http://localhost:${PORT}`);
});
