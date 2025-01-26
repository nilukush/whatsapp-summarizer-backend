const logger = require('./config/logger');
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const app = express();
app.use(cors());

// WhatsApp OAuth Configuration
const WA_CLIENT_ID = process.env.WA_CLIENT_ID;
const WA_CLIENT_SECRET = process.env.WA_CLIENT_SECRET;
const REDIRECT_URI = 'https://your-digitalocean-app.com/auth/callback';

// Step 1: Redirect users to WhatsApp OAuth
app.get('/auth/whatsapp', (req, res) => {
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${WA_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=whatsapp_business_management`;
  res.redirect(authUrl);
});

// Step 2: Handle OAuth callback
app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${WA_CLIENT_ID}&client_secret=${WA_CLIENT_SECRET}&code=${code}&redirect_uri=${REDIRECT_URI}`
    );
    const accessToken = data.access_token;
    logger.info(`Access token: ${accessToken}`);
    // Store token securely (e.g., in Redis)
    res.send('Authentication successful!');
  } catch (error) {
    res.status(500).send('Authentication failed.');
  }
});

// Verify webhook (required by Meta)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Handle incoming messages
app.post('/webhook', async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (message) {
    await supabase
      .from('message_queue')
      .insert([{ content: message }]);
  }
  res.sendStatus(200);
});

app.listen(3000, () => console.log('Server running on port 3000'));
