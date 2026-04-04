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

  // Fetch inventory context
  let inventoryContext = '';
  try {
    const inventory = await convex.query(api.shop.getInventory, { userId });
    if (inventory && inventory.length > 0) {
      const itemNames = inventory.map(i => i.name);
      const hasBlahaj = itemNames.includes('Blahaj');
      inventoryContext = `\n[USER INVENTORY: ${itemNames.join(', ')}]`;
      if (hasBlahaj) {
        inventoryContext += '\n[WARNING: THIS USER OWNS A BLAHAJ. You are deeply distressed about this. Kevin must not find out. Express visible discomfort whenever they mention it or anything shark-related. You are conflicted because you secretly love blahajs but Kevin has forbidden them.]';
      }
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
    { role: 'system', content: SYSTEM_PROMPT + profileContext + bankingContext + inventoryContext },
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

// --- Shop interaction handlers ---
const SHOP_ITEMS = {
  blahaj: { name: 'Blahaj', price: 49.99 },
  fee_insurance: { name: 'Fee Insurance', price: 99.99 },
  kevins_briefcase: { name: "Kevin's Briefcase", price: 250.00 },
  office_light_bulb: { name: 'Office Light Bulb', price: 5.00 },
  incident_report: { name: '2019 Incident Report', price: 500.00 },
  southbag_mug: { name: 'Southbag Mug', price: 12.50 },
  kevins_parking_spot: { name: "Kevin's Parking Spot", price: 1000.00 },
};

const GIFT_ANNOUNCEMENTS = {
  blahaj: "Southbag Support has gone offline.",
  fee_insurance: "Southbag Support is recalculating your fees. Nervously.",
  kevins_briefcase: "Kevin would like a word.",
  office_light_bulb: "The flickering light in aisle 3 has been claimed.",
  incident_report: "Legal has been notified. Again.",
  southbag_mug: "HR is pretending not to notice.",
  kevins_parking_spot: "Kevin is circling the parking lot. He looks upset.",
};

// Handle overflow menu actions from shop
app.action(/^shop_action_/, async ({ action, ack, body, client }) => {
  await ack();
  const userId = body.user.id;
  const value = action.selected_option.value;
  const [actionType, ...itemParts] = value.split('_');
  const itemId = actionType === 'buy' ? itemParts.join('_') : itemParts.join('_');

  if (actionType === 'buy') {
    const result = await convex.mutation(api.shop.buyItem, { userId, itemId });

    if (result.error === 'no_account') {
      await client.chat.postEphemeral({ channel: userId, user: userId, text: "No account. How did you even get here?" });
      return;
    }
    if (result.error === 'insufficient') {
      const roasts = [
        `You have $${result.balance.toFixed(2)} and this costs $${result.price.toFixed(2)}. Do the math. Actually, don't. You clearly can't.`,
        `Insufficient funds for ${result.itemName}. Have you tried not being broke?`,
        `$${result.balance.toFixed(2)} in your account and you're trying to buy a $${result.price.toFixed(2)} item. The audacity.`,
        `You can't afford ${result.itemName}. Maybe try /south-beg first. It suits you.`,
      ];
      await client.chat.postEphemeral({ channel: userId, user: userId, text: roasts[Math.floor(Math.random() * roasts.length)] });
      return;
    }
    if (result.error === 'frozen') {
      await client.chat.postEphemeral({ channel: userId, user: userId, text: "Your account is frozen. No shopping sprees for you." });
      return;
    }
    if (result.error) {
      await client.chat.postEphemeral({ channel: userId, user: userId, text: `Error: ${result.error}` });
      return;
    }

    await notifyBalanceChange(client, convex, api, userId, `Shop: ${result.itemName}`, -result.price, result.newBalance);
    await client.chat.postEphemeral({
      channel: userId,
      user: userId,
      text: `You bought *${result.itemName}* for $${result.price.toFixed(2)}.\nNew balance: $${result.newBalance.toFixed(2)}\n\n_Check /south-inventory to admire your questionable purchases._`,
    });
  } else if (actionType === 'gift') {
    // Open gift modal with user picker
    const item = SHOP_ITEMS[itemId];
    if (!item) return;

    try {
      const giftView = {
        type: 'modal',
        callback_id: 'gift_modal',
        private_metadata: JSON.stringify({ itemId, senderId: userId }),
        title: { type: 'plain_text', text: 'Gift an Item' },
        submit: { type: 'plain_text', text: 'Send Gift' },
        close: { type: 'plain_text', text: 'Nevermind' },
        blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: `*${item.name}* — $${item.price.toFixed(2)}\n_This will be deducted from your balance._` },
            },
            {
              type: 'input',
              block_id: 'recipient_block',
              element: {
                type: 'users_select',
                action_id: 'recipient',
                placeholder: { type: 'plain_text', text: 'Pick a victim' },
              },
              label: { type: 'plain_text', text: 'Recipient' },
            },
            {
              type: 'input',
              block_id: 'message_block',
              optional: true,
              element: {
                type: 'plain_text_input',
                action_id: 'gift_message',
                placeholder: { type: 'plain_text', text: 'Optional message (they probably won\'t appreciate it)' },
              },
              label: { type: 'plain_text', text: 'Message' },
            },
          ],
        };

      // If triggered from inside a modal, push onto the stack; otherwise open new
      if (body.view) {
        await client.views.push({ trigger_id: body.trigger_id, view: giftView });
      } else {
        await client.views.open({ trigger_id: body.trigger_id, view: giftView });
      }
    } catch (e) {
      console.error('Error opening gift modal:', e);
    }
  } else if (actionType === 'buymulti') {
    const item = SHOP_ITEMS[itemId];
    if (!item) return;

    try {
      const buyMultiView = {
        type: 'modal',
        callback_id: 'buy_multi_modal',
        private_metadata: JSON.stringify({ itemId, userId }),
        title: { type: 'plain_text', text: 'Buy Multiple' },
        submit: { type: 'plain_text', text: 'Buy' },
        close: { type: 'plain_text', text: 'Nevermind' },
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*${item.name}* — $${item.price.toFixed(2)} each\n_Why buy one when you can regret buying many?_` },
          },
          {
            type: 'input',
            block_id: 'quantity_block',
            element: {
              type: 'number_input',
              action_id: 'quantity',
              is_decimal_allowed: false,
              min_value: '1',
              max_value: '99',
              placeholder: { type: 'plain_text', text: 'How many?' },
            },
            label: { type: 'plain_text', text: 'Quantity' },
          },
        ],
      };

      if (body.view) {
        await client.views.push({ trigger_id: body.trigger_id, view: buyMultiView });
      } else {
        await client.views.open({ trigger_id: body.trigger_id, view: buyMultiView });
      }
    } catch (e) {
      console.error('Error opening buy multiple modal:', e);
    }
  } else if (actionType === 'giftkevin') {
    const item = SHOP_ITEMS[itemId];
    if (!item) return;

    const result = await convex.mutation(api.shop.giftToKevin, { userId, itemId });

    if (result.error === 'insufficient') {
      await client.chat.postEphemeral({ channel: userId, user: userId, text: `You can't afford to tribute Kevin. You have $${result.balance.toFixed(2)} and this costs $${result.price.toFixed(2)}. He'll remember this.` });
      return;
    }
    if (result.error === 'frozen') {
      await client.chat.postEphemeral({ channel: userId, user: userId, text: "Your account is frozen. Kevin does not accept gifts from the frozen." });
      return;
    }
    if (result.error) {
      await client.chat.postEphemeral({ channel: userId, user: userId, text: `Error: ${result.error}` });
      return;
    }

    await notifyBalanceChange(client, convex, api, userId, `Tribute to Kevin: ${result.itemName}`, -result.price, result.newBalance);

    const kevinReactions = [
      "Kevin has acknowledged your offering. He did not smile.",
      "Kevin took it without a word. This is the best possible outcome.",
      "Kevin looked at it, looked at you, and walked away. Progress.",
      "Kevin's assistant placed it on The Pile. You don't ask about The Pile.",
      "Kevin nodded. You have never seen Kevin nod before. You feel strange.",
    ];
    const reaction = kevinReactions[Math.floor(Math.random() * kevinReactions.length)];

    try {
      await client.chat.postMessage({
        channel: ALLOWED_CHANNEL,
        text: `<@${userId}> has offered a *${result.itemName}* as tribute to Kevin.\n\n_${reaction}_`,
      });
    } catch (e) {
      console.error('Error posting Kevin tribute announcement:', e);
    }
  }
});

// Handle gift modal submission
app.view('gift_modal', async ({ view, ack, client }) => {
  const { itemId, senderId } = JSON.parse(view.private_metadata);
  const recipientId = view.state.values.recipient_block.recipient.selected_user;
  const giftMessage = view.state.values.message_block?.gift_message?.value || '';

  const result = await convex.mutation(api.shop.giftItem, { senderId, recipientId, itemId });

  if (result.error === 'self_gift') {
    await ack({ response_action: 'errors', errors: { recipient_block: "You can't gift yourself. That's just buying with extra steps." } });
    return;
  }
  if (result.error === 'no_recipient') {
    await ack({ response_action: 'errors', errors: { recipient_block: "That user doesn't have a Southbag account." } });
    return;
  }
  if (result.error === 'insufficient') {
    await ack({ response_action: 'errors', errors: { recipient_block: `You can't afford this ($${result.price.toFixed(2)}). Balance: $${result.balance.toFixed(2)}.` } });
    return;
  }
  if (result.error) {
    await ack({ response_action: 'errors', errors: { recipient_block: `Error: ${result.error}` } });
    return;
  }

  await ack();

  await notifyBalanceChange(client, convex, api, senderId, `Gift: ${result.itemName}`, -result.price, result.senderNewBalance);

  const announcement = GIFT_ANNOUNCEMENTS[itemId] || 'Southbag Support has no comment.';
  const msgLine = giftMessage ? `\n_"${giftMessage}"_` : '';

  // Announce in the allowed channel
  try {
    await client.chat.postMessage({
      channel: ALLOWED_CHANNEL,
      text: `<@${senderId}> just gifted a *${result.itemName}* to <@${recipientId}>.${msgLine}\n\n_${announcement}_`,
    });
  } catch (e) {
    console.error('Error posting gift announcement:', e);
  }
});

// Handle buy multiple modal submission
app.view('buy_multi_modal', async ({ view, ack, client }) => {
  const { itemId, userId } = JSON.parse(view.private_metadata);
  const quantity = parseInt(view.state.values.quantity_block.quantity.value, 10);

  const result = await convex.mutation(api.shop.buyMultipleItems, { userId, itemId, quantity });

  if (result.error === 'insufficient') {
    await ack({ response_action: 'errors', errors: { quantity_block: `You can't afford ${quantity}x ($${result.price.toFixed(2)} total). Balance: $${result.balance.toFixed(2)}.` } });
    return;
  }
  if (result.error === 'frozen') {
    await ack({ response_action: 'errors', errors: { quantity_block: "Your account is frozen." } });
    return;
  }
  if (result.error) {
    await ack({ response_action: 'errors', errors: { quantity_block: `Error: ${result.error}` } });
    return;
  }

  await ack();

  await notifyBalanceChange(client, convex, api, userId, `Shop: ${result.itemName} x${result.quantity}`, -result.totalCost, result.newBalance);
  await client.chat.postEphemeral({
    channel: userId,
    user: userId,
    text: `You bought *${result.quantity}x ${result.itemName}* for $${result.totalCost.toFixed(2)}.\nNew balance: $${result.newBalance.toFixed(2)}\n\n_${result.quantity} of the same thing. Bold strategy._`,
  });
});

// --- Start ---
(async () => {
  await app.start();
  console.log('⚡ Southbag bot is running (Socket Mode)');
})();
