const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const OpenAI = require('openai');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, { 
  cors: { origin: '*' },
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from current folder (not public/)
app.use(express.static(__dirname));

// OpenAI setup
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || 'demo-key'
});

// ================= MEMORY =================
let allPosts = [];
let chatRooms = {};
let userPersonas = {};
let onlineUsers = {};

// ================= AI ENDPOINT =================
app.post('/api/ai-respond', async (req, res) => {
  try {
    const { message, persona } = req.body;

    // Agar API key nahi hai, fallback do
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-key') {
      const fallbacks = [
        "lmaoo that's wild 😂",
        "ong fr fr, I feel that",
        "no cap, you spittin facts",
        "bet say less fam",
        "I'm dead 💀💀",
        "yooo that's actually fire 🔥"
      ];
      return res.json({ response: fallbacks[Math.floor(Math.random() * fallbacks.length)] });
    }

    const systemPrompt = `You are an AI social media avatar. Speak EXACTLY like the user.
Rules:
- Reply in 1-2 sentences MAX
- Use slang: "fr", "lmao", "ong", "bet", "no cap", "bruh", "fam"
- Use emojis naturally
- NEVER sound like a robot
- Be casual, sometimes sarcastic
- Use lowercase mostly

User style: ${persona || 'Casual texter, uses abbreviations and emojis'}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.9,
      max_tokens: 80
    });

    res.json({ response: completion.choices[0].message.content });

  } catch (err) {
    console.error('AI Error:', err.message);
    const fallbacks = ["lmaoo that's wild 😂", "ong fr fr", "no cap 🔥", "bet say less", "I'm dead 💀"];
    res.json({ response: fallbacks[Math.floor(Math.random() * fallbacks.length)] });
  }
});

// ================= POSTS API =================
app.get('/api/posts', (req, res) => res.json(allPosts));

app.post('/api/posts', (req, res) => {
  const post = { 
    ...req.body, 
    id: Date.now().toString(), 
    createdAt: new Date().toISOString(),
    likes: 0,
    likedBy: [],
    comments: []
  };
  allPosts.unshift(post);
  if (allPosts.length > 100) allPosts = allPosts.slice(0, 100);
  res.json(post);
});

app.post('/api/posts/:id/like', (req, res) => {
  const post = allPosts.find(p => p.id === req.params.id);
  if (post) { post.likes += 1; res.json({ success: true }); }
  else res.status(404).json({ error: 'Not found' });
});

// ================= PERSONA API =================
app.post('/api/persona', (req, res) => {
  userPersonas[req.body.userId] = req.body.persona;
  res.json({ success: true });
});

app.get('/api/persona/:userId', (req, res) => {
  res.json({ persona: userPersonas[req.params.userId] || '' });
});

// ================= SOCKET.IO =================
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ room, user }) => {
    socket.join(room);
    onlineUsers[socket.id] = user;
    if (chatRooms[room]) socket.emit('chat-history', chatRooms[room]);
    socket.to(room).emit('user-joined', user);
  });

  socket.on('send-message', ({ room, message }) => {
    if (!chatRooms[room]) chatRooms[room] = [];
    chatRooms[room].push(message);
    if (chatRooms[room].length > 100) chatRooms[room] = chatRooms[room].slice(-100);
    socket.to(room).emit('receive-message', message);
  });

  socket.on('typing', ({ room }) => {
    socket.to(room).emit('typing', {});
  });

  socket.on('disconnect', () => {
    delete onlineUsers[socket.id];
    console.log('User disconnected:', socket.id);
  });
});

// ================= START =================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║     PERSONA APP IS RUNNING! 🔥       ║');
  console.log('╠═══════════════════════════════════════╣');
  console.log('║  Open Chrome and go to:               ║');
  console.log('║  http://localhost:' + PORT + '              ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
});
