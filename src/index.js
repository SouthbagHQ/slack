require('dotenv').config();
const { App } = require('@slack/bolt');
const { ConvexHttpClient } = require('convex/browser');
const { api } = require('../convex/_generated/api');
const { chat } = require('./ai');
const { parseCommands, executeCommands } = require('./commands');
const { SYSTEM_PROMPT } = require('./prompt');
const { registerBankingCommands, notifyBalanceChange } = require('./banking');
const { registerAppHome } = require('./home');

const ALLOWED_CHANNEL = 'C0AH7GB4V6X';

const convex = new ConvexHttpClient(process.env.CONVEX_URL);

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// --- Env shim so ai.js can read keys the same way ---
const env = {
  HCAI: process.env.HCAI,
};

// --- Main message handler ---
async function handleMessage({ event, client }) {
  if (event.bot_id || event.subtype) return;

  const isDM = event.channel_type === 'im';
  if (!isDM && event.channel !== ALLOWED_CHANNEL) return;

  const channelId = event.channel;
  const threadTs = event.thread_ts || event.ts;
  const userId = event.user;

  const say = async (opts) => {
    if (typeof opts === 'string') opts = { text: opts, channel: channelId };
    await client.chat.postMessage({ channel: channelId, ...opts });
  };

  let userText = (event.text || '').replace(/<@[A-Z0-9]+>/g, '').trim();
  if (!userText) return;
  if (userText.startsWith('##')) return;

  // Fetch user profile for roasting
  let profileContext = '';
  try {
    const userInfo = await client.users.info({ user: userId });
    const p = userInfo.user.profile || {};
    const tz = userInfo.user.tz_label || userInfo.user.tz || 'Unknown';
    const parts = [];
    if (p.display_name || p.real_name) parts.push(`Name: ${p.display_name || p.real_name}`);
    if (p.first_name) parts.push(`First name: ${p.first_name}`);
    if (p.last_name) parts.push(`Last name: ${p.last_name}`);
    if (p.title) parts.push(`Title: ${p.title}`);
    if (p.email) parts.push(`Email: ${p.email}`);
    if (p.phone) parts.push(`Phone: ${p.phone}`);
    if (p.status_text) parts.push(`Status: "${p.status_text}" ${p.status_emoji || ''}`);
    parts.push(`Timezone: ${tz}`);
    if (p.pronouns) parts.push(`Pronouns: ${p.pronouns}`);
    if (p.start_date) parts.push(`Start date: ${p.start_date}`);
    if (p.fields && Object.keys(p.fields).length > 0) {
      for (const [, field] of Object.entries(p.fields)) {
        if (field.value) parts.push(`Custom field: ${field.alt || field.label || ''}: ${field.value}`);
      }
    }
    if (userInfo.user.is_admin) parts.push('Is a workspace admin');
    if (userInfo.user.is_owner) parts.push('Is the workspace owner');
    profileContext = `\n[USER SLACK PROFILE (use this to roast them): ${parts.join('. ')}]`;
  } catch (e) {}

  // Fetch banking context
  let bankingContext = '';
  try {
    const account = await convex.query(api.accounts.getBalance, { userId });
    if (account) {
      bankingContext = `\n[USER BANKING INFO: Account ${account.accountNumber}, Balance: $${account.balance.toFixed(2)}, Status: ${account.status}]`;
    } else {
      bankingContext = '\n[USER HAS NO ACCOUNT - suggest they use /south-open-account if they ask about banking]';
    }
  } catch (e) {}

  // Store user message
  await convex.mutation(api.messages.store, {
    channelId,
    threadTs,
    role: 'user',
    content: userText,
    userId,
    createdAt: Date.now(),
  });

  // Fetch conversation history
  const history = await convex.query(api.messages.getHistory, { channelId, threadTs });
  const recentHistory = history.slice(-20);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + profileContext + bankingContext },
    ...recentHistory.map((msg) => ({ role: msg.role, content: msg.content })),
  ];

  try {
    const aiResponse = await chat(messages, env);
    const { cleanText, commands } = parseCommands(aiResponse);

    await convex.mutation(api.messages.store, {
      channelId,
      threadTs,
      role: 'assistant',
      content: cleanText,
      createdAt: Date.now(),
    });

    if (cleanText) {
      await say({ text: cleanText, thread_ts: threadTs });
    }

    await executeCommands(commands, say, client, event, { convex, api, notifyBalanceChange });
  } catch (err) {
    console.error('Error handling message:', err);
    await say({
      text: "Look, even our systems don't want to deal with you right now. Try again later.",
      thread_ts: threadTs,
    });
  }
}

// --- Event listeners ---
app.event('app_mention', async (args) => {
  await handleMessage(args);
});

app.event('message', async (args) => {
  const { event } = args;
  if (event.channel_type === 'im') {
    await handleMessage(args);
    return;
  }
  if (event.channel === ALLOWED_CHANNEL && event.thread_ts && !event.bot_id && !event.subtype) {
    await handleMessage(args);
  }
});

// --- App Home ---
app.event('app_home_opened', async ({ event, client }) => {
  if (event.tab !== 'home') return;
  const userId = event.user;

  const [account, job, loan, transactions, crypto, insurance] = await Promise.all([
    convex.query(api.accounts.get, { userId }).catch(() => null),
    convex.query(api.jobs.getJob, { userId }).catch(() => null),
    convex.query(api.loans.check, { userId }).catch(() => null),
    convex.query(api.transactions.list, { userId }).catch(() => []),
    convex.query(api.crypto.portfolio, { userId }).catch(() => null),
    convex.query(api.insurance.getPlan, { userId }).catch(() => null),
  ]);

  const { buildHomeBlocks } = require('./home');
  const blocks = buildHomeBlocks(account, job, loan, transactions, crypto, insurance);

  await client.views.publish({
    user_id: userId,
    view: { type: 'home', blocks },
  });
});

// --- Slash commands ---
// Create a Bolt-compatible shim so registerBankingCommands works unchanged
const boltApp = {
  command: (name, handler) => {
    app.command(name, async ({ command, ack, respond, client }) => {
      await handler({ command, ack, respond, client });
    });
  },
  event: () => {},
};
registerBankingCommands(boltApp, convex, api);

// --- Start ---
(async () => {
  await app.start();
  console.log('⚡ Southbag bot is running (Socket Mode)');
})();
