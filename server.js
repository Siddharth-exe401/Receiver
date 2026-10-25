import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let records = [];
let clients = new Set();

// 1. GET / serves the dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. POST / catches the JSON payload (Matches your friend's code)
app.post('/', (req, res) => {
  const incoming = {
    id: Date.now().toString(36),
    timestamp: new Date().toLocaleTimeString(),
    headers: req.headers,
    body: req.body
  };

  records.unshift(incoming);
  if (records.length > 50) records.pop();

  // Push immediately to the live webpage
  clients.forEach((client) => {
    client.write(`data: ${JSON.stringify(incoming)}\n\n`);
  });

  res.status(200).json({ status: 'success', received: true });
});

// 3. Real-time stream for the UI
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send past records on initial load
  res.write(`data: ${JSON.stringify({ type: 'INIT', history: records })}\n\n`);

  clients.add(res);
  req.on('close', () => clients.delete(res));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
                      
