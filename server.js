import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const bins = new Map();
const subscribers = new Map();

function getOrCreateBin(binId) {
  if (!bins.has(binId)) {
    bins.set(binId, []);
    subscribers.set(binId, new Set());
  }
  return bins.get(binId);
}

app.get('/b/:binId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.all('/api/catch/:binId', (req, res) => {
  const { binId } = req.params;
  const bin = getOrCreateBin(binId);

  const incomingRecord = {
    id: crypto.randomUUID(),
    timestamp: new Date().toLocaleTimeString(),
    method: req.method,
    headers: req.headers,
    query: req.query,
    body: req.body
  };

  bin.unshift(incomingRecord);
  if (bin.length > 50) bin.pop();

  const clients = subscribers.get(binId);
  if (clients) {
    clients.forEach((client) => {
      client.write(`data: ${JSON.stringify(incomingRecord)}\n\n`);
    });
  }

  res.status(200).json({ status: 'ok', received: true });
});

app.get('/api/stream/:binId', (req, res) => {
  const { binId } = req.params;
  getOrCreateBin(binId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const history = bins.get(binId) || [];
  res.write(`data: ${JSON.stringify({ type: 'INIT', history })}\n\n`);

  subscribers.get(binId).add(res);

  req.on('close', () => {
    subscribers.get(binId).delete(res);
  });
});

app.get('/', (req, res) => {
  const newBinId = crypto.randomBytes(4).toString('hex');
  res.redirect(`/b/${newBinId}`);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
        
