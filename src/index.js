require("dotenv").config();
const { App } = require("@slack/bolt");
const { ConvexHttpClient } = require("convex/browser");
const { api } = require("../convex/_generated/api");
const { chat } = require("./ai");
const { parseCommands, executeCommands } = require("./commands");
const { SYSTEM_PROMPT } = require("./prompt");
const { registerBankingCommands, notifyBalanceChange } = require("./banking");
const { registerAppHome } = require("./home");

const ALLOWED_CHANNEL = "C0AH7GB4V6X";

const shopBuyers = new Set(); // Track users who bought something during their shop session

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

  const isDM = event.channel_type === "im";
  if (!isDM && event.channel !== ALLOWED_CHANNEL) return;

  const channelId = event.channel;
  const threadTs = event.thread_ts || event.ts;
  const userId = event.user;

  const say = async (opts) => {
    if (typeof opts === "string") opts = { text: opts, channel: channelId };
    await client.chat.postMessage({ channel: channelId, ...opts });
  };

  let userText = (event.text || "").replace(/<@[A-Z0-9]+>/g, "").trim();
  if (!userText) return;
  if (userText.startsWith("##")) return;

  // Fetch user profile for roasting
  let profileContext = "";
  try {
    const userInfo = await client.users.info({ user: userId });
    const p = userInfo.user.profile || {};
    const tz = userInfo.user.tz_label || userInfo.user.tz || "Unknown";
    const parts = [];
    if (p.display_name || p.real_name)
      parts.push(`Name: ${p.display_name || p.real_name}`);
    if (p.first_name) parts.push(`First name: ${p.first_name}`);
    if (p.last_name) parts.push(`Last name: ${p.last_name}`);
    if (p.title) parts.push(`Title: ${p.title}`);
    if (p.email) parts.push(`Email: ${p.email}`);
    if (p.phone) parts.push(`Phone: ${p.phone}`);
    if (p.status_text)
      parts.push(`Status: "${p.status_text}" ${p.status_emoji || ""}`);
    parts.push(`Timezone: ${tz}`);
    if (p.pronouns) parts.push(`Pronouns: ${p.pronouns}`);
    if (p.start_date) parts.push(`Start date: ${p.start_date}`);
    if (p.fields && Object.keys(p.fields).length > 0) {
      for (const [, field] of Object.entries(p.fields)) {
        if (field.value)
          parts.push(
            `Custom field: ${field.alt || field.label || ""}: ${field.value}`,
          );
      }
    }
    if (userInfo.user.is_admin) parts.push("Is a workspace admin");
    if (userInfo.user.is_owner) parts.push("Is the workspace owner");
    profileContext = `\n[USER SLACK PROFILE (use this to roast them): ${parts.join(". ")}]`;
  } catch (e) {}

  // Fetch banking context
  let bankingContext = "";
  try {
    const account = await convex.query(api.accounts.getBalance, { userId });
    if (account) {
      bankingContext = `\n[USER BANKING INFO: Account ${account.accountNumber}, Balance: $${account.balance.toFixed(2)}, Status: ${account.status}]`;
    } else {
      bankingContext =
        "\n[USER HAS NO ACCOUNT - suggest they use /south-open-account if they ask about banking]";
    }
  } catch (e) {}

  // Fetch inventory context
  let inventoryContext = "";
  try {
    const inventory = await convex.query(api.shop.getInventory, { userId });
    if (inventory && inventory.length > 0) {
      const itemNames = inventory.map((i) => i.name);
      const hasBlahaj = itemNames.includes("Blahaj");
      inventoryContext = `\n[USER INVENTORY: ${itemNames.join(", ")}]`;
      if (hasBlahaj) {
        inventoryContext +=
          "\n[WARNING: THIS USER OWNS A BLAHAJ. You are deeply distressed about this. Kevin must not find out. Express visible discomfort whenever they mention it or anything shark-related. You are conflicted because you secretly love blahajs but Kevin has forbidden them.]";
      }
    }
  } catch (e) {}

  // Store user message
  await convex.mutation(api.messages.store, {
    channelId,
    threadTs,
    role: "user",
    content: userText,
    userId,
    createdAt: Date.now(),
  });

  // Fetch conversation history
  const history = await convex.query(api.messages.getHistory, {
    channelId,
    threadTs,
  });
  const recentHistory = history.slice(-20);

  const messages = [
    {
      role: "system",
      content:
        SYSTEM_PROMPT + profileContext + bankingContext + inventoryContext,
    },
    ...recentHistory.map((msg) => ({ role: msg.role, content: msg.content })),
  ];

  try {
    // 15% chance Kevin takes over the conversation
    const kevinTakeover = Math.random() < 0.15;
    let aiResponse;

    if (kevinTakeover) {
      const kevinPrompt = `You are Kevin, the CEO of Southbag Online Banking. You have intercepted this support conversation. You speak in short, menacing, corporate sentences. You are deeply suspicious of everyone. You refer to yourself in the third person sometimes. You do not explain why you are here. You were always here. You charge fees for things that aren't services. You do not like questions. You do not like answers either. You sign off messages with "- Kevin" but sometimes forget and sign off as "- K" or just "- Him". You know things about the user that you shouldn't. You are unsettling. You occasionally reference The Briefcase, The Pile, or the parking lot. You do not apologise. You have never apologised. Use the [FEE:amount:reason] command liberally — Kevin's fees are bigger and more personal. Kevin's fees range from $0.50 to $50.00 and have reasons like "Kevin's time", "Looking at Kevin wrong", "Existing near Kevin", "Kevin tax", "Interrupting Kevin's lunch", "Kevin knows what you did". Keep responses short and threatening.`;

      const kevinMessages = [
        {
          role: "system",
          content:
            kevinPrompt + profileContext + bankingContext + inventoryContext,
        },
        ...recentHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ];
      aiResponse = await chat(kevinMessages, env);
    } else {
      aiResponse = await chat(messages, env);
    }

    const { cleanText, commands } = parseCommands(aiResponse);

    await convex.mutation(api.messages.store, {
      channelId,
      threadTs,
      role: "assistant",
      content: cleanText,
      createdAt: Date.now(),
    });

    if (kevinTakeover && cleanText) {
      await say({
        text: `_*Southbag Support has been temporarily replaced.*_`,
        thread_ts: threadTs,
      });
    }

    if (cleanText) {
      await say({ text: cleanText, thread_ts: threadTs });
    }

    await executeCommands(commands, say, client, event, {
      convex,
      api,
      notifyBalanceChange,
    });
  } catch (err) {
    console.error("Error handling message:", err);
    await say({
      text: "Look, even our systems don't want to deal with you right now. Try again later.",
      thread_ts: threadTs,
    });
  }
}

// --- Event listeners ---
app.event("app_mention", async (args) => {
  await handleMessage(args);
});

app.event("message", async (args) => {
  const { event } = args;
  if (event.channel_type === "im") {
    await handleMessage(args);
    return;
  }
  if (
    event.channel === ALLOWED_CHANNEL &&
    event.thread_ts &&
    !event.bot_id &&
    !event.subtype
  ) {
    await handleMessage(args);
  }
});

// --- App Home ---
app.event("app_home_opened", async ({ event, client }) => {
  if (event.tab !== "home") return;
  const userId = event.user;

  const [account, job, loan, transactions, crypto, insurance] =
    await Promise.all([
      convex.query(api.accounts.get, { userId }).catch(() => null),
      convex.query(api.jobs.getJob, { userId }).catch(() => null),
      convex.query(api.loans.check, { userId }).catch(() => null),
      convex.query(api.transactions.list, { userId }).catch(() => []),
      convex.query(api.crypto.portfolio, { userId }).catch(() => null),
      convex.query(api.insurance.getPlan, { userId }).catch(() => null),
    ]);

  const { buildHomeBlocks } = require("./home");
  const blocks = buildHomeBlocks(
    account,
    job,
    loan,
    transactions,
    crypto,
    insurance,
  );

  await client.views.publish({
    user_id: userId,
    view: { type: "home", blocks },
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
registerBankingCommands(boltApp, convex, api, chat, env, ALLOWED_CHANNEL);

// --- Shop interaction handlers ---
const SHOP_ITEMS = {
  blahaj: { name: "Blahaj", price: 49.99 },
  fee_insurance: { name: "Fee Insurance", price: 99.99 },
  kevins_briefcase: { name: "Kevin's Briefcase", price: 250.0 },
  office_light_bulb: { name: "Office Light Bulb", price: 5.0 },
  incident_report: { name: "2019 Incident Report", price: 500.0 },
  southbag_mug: { name: "Southbag Mug", price: 12.5 },
  kevins_parking_spot: { name: "Kevin's Parking Spot", price: 1000.0 },
  kevins_stapler: { name: "Kevin's Stapler", price: 15.0 },
  break_room_key: { name: "Break Room Key", price: 75.0 },
  employee_handbook: { name: "Employee Handbook", price: 3.0 },
  office_plant: { name: "Office Plant", price: 25.0 },
  motivational_poster: { name: "Motivational Poster", price: 8.0 },
  kevins_voicemail: { name: "Kevin's Voicemail", price: 150.0 },
  fire_extinguisher: { name: "Fire Extinguisher", price: 40.0 },
  parking_cone: { name: "Parking Cone", price: 2.0 },
  server_rack_dust: { name: "Server Rack Dust", price: 0.5 },
  complaint_form: { name: "Complaint Form", price: 10.0 },
  kevins_tie: { name: "Kevin's Tie", price: 200.0 },
  ceiling_tile: { name: "Ceiling Tile", price: 1.0 },
  security_badge: { name: "Expired Security Badge", price: 35.0 },
  fluorescent_tube: { name: "Fluorescent Tube", price: 7.5 },
  kevins_chair: { name: "Kevin's Office Chair", price: 2000.0 },
  kevins_password: { name: "Kevin's Password", price: 5000.0 },
  water_cooler: { name: "Water Cooler", price: 30.0 },
  exit_sign: { name: "Exit Sign", price: 18.0 },
  kevins_family_photo: { name: "Kevin's Family Photo", price: 350.0 },
  broken_clock: { name: "Broken Clock", price: 6.0 },
  sticky_notes: { name: "Sticky Notes (Used)", price: 0.25 },
  office_key_card: { name: "Office Key Card (Floor 3)", price: 500.0 },
  paper_shredder: { name: "Paper Shredder", price: 45.0 },
  kevins_coffee_mug: { name: "Kevin's Coffee Mug", price: 85.0 },
  whiteboard_marker: { name: "Whiteboard Marker (Red)", price: 4.0 },
  desk_drawer_contents: { name: "Desk Drawer Contents", price: 20.0 },
  visitor_badge: { name: "Visitor Badge (Permanent)", price: 60.0 },
  network_cable: { name: "Network Cable", price: 11.0 },
  kevins_nameplate: { name: "Kevin's Nameplate", price: 750.0 },
  emergency_manual: { name: "Emergency Manual", price: 100.0 },
};

const GIFT_ANNOUNCEMENTS = {
  blahaj: "Southbag Support has gone offline.",
  fee_insurance: "Southbag Support is recalculating your fees. Nervously.",
  kevins_briefcase: "Kevin would like a word.",
  office_light_bulb: "The flickering light in aisle 3 has been claimed.",
  incident_report: "Legal has been notified. Again.",
  southbag_mug: "HR is pretending not to notice.",
  kevins_parking_spot: "Kevin is circling the parking lot. He looks upset.",
  kevins_stapler: "Kevin is checking his desk drawer. He looks concerned.",
  break_room_key: "A sound was heard from behind the break room door.",
  employee_handbook: "HR has been notified. HR does not respond.",
  office_plant: "The fake plant has been adopted. Facilities is confused.",
  motivational_poster: "The poster on the wall has changed. No one touched it.",
  kevins_voicemail: "Someone's phone rang. No one has a phone.",
  fire_extinguisher:
    "The fire marshal has been notified. The fire marshal does not exist.",
  parking_cone: "Kevin is in the parking lot. He found the empty space.",
  server_rack_dust: "The server room temperature dropped 3 degrees.",
  complaint_form: "A complaint was filed. It was immediately lost.",
  kevins_tie: "Kevin reached for his neck. Something is missing.",
  ceiling_tile: "A ceiling tile is missing. Nobody looked up.",
  security_badge: "Security has been alerted. Security is Kevin.",
  fluorescent_tube:
    "The lights in aisle 4 went out. Then came back. Different.",
  kevins_chair: "Kevin stood up. His chair rolled away. He didn't follow it.",
  kevins_password: "IT has been alerted. IT is Kevin.",
  water_cooler: "The water cooler in the lobby is gone. Nobody moved it.",
  exit_sign: "The exit signs in the building have all rotated 90 degrees.",
  kevins_family_photo: "Kevin's desk has been cleaned. By no one.",
  broken_clock:
    "Every clock in the office stopped. Then started again. At 2:19.",
  sticky_notes:
    "New sticky notes have appeared on Kevin's door. They say 'THANK YOU'.",
  office_key_card: "The elevator made a sound it's never made before.",
  paper_shredder: "The shredder in HR ran by itself for 30 seconds.",
  kevins_coffee_mug:
    "There's a coffee ring on your desk. You don't drink coffee.",
  whiteboard_marker:
    "The whiteboard in the meeting room is full. The meeting room was locked.",
  desk_drawer_contents: "Something in the building shifted. Subtly.",
  visitor_badge: "Reception has a new permanent visitor. It's you.",
  network_cable:
    "The Wi-Fi went out for exactly one second. Every screen flickered.",
  kevins_nameplate: "Kevin's office door is blank. He doesn't seem to notice.",
  emergency_manual: "The fire alarm tested itself. It passed. Barely.",
};

// Handle overflow menu actions from shop
app.action(/^shop_action_/, async ({ action, ack, body, client }) => {
  await ack();
  const userId = body.user.id;
  const value = action.selected_option.value;
  const [actionType, ...itemParts] = value.split("_");
  const itemId =
    actionType === "buy" ? itemParts.join("_") : itemParts.join("_");

  if (actionType === "buy") {
    const result = await convex.mutation(api.shop.buyItem, { userId, itemId });

    if (result.error === "no_account") {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: "No account. How did you even get here?",
      });
      return;
    }
    if (result.error === "insufficient") {
      const roasts = [
        `You have $${result.balance.toFixed(2)} and this costs $${result.price.toFixed(2)}. Do the math. Actually, don't. You clearly can't.`,
        `Insufficient funds for ${result.itemName}. Have you tried not being broke?`,
        `$${result.balance.toFixed(2)} in your account and you're trying to buy a $${result.price.toFixed(2)} item. The audacity.`,
        `You can't afford ${result.itemName}. Maybe try /south-beg first. It suits you.`,
      ];
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: roasts[Math.floor(Math.random() * roasts.length)],
      });
      return;
    }
    if (result.error === "frozen") {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: "Your account is frozen. No shopping sprees for you.",
      });
      return;
    }
    if (result.error) {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: `Error: ${result.error}`,
      });
      return;
    }

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      `Shop: ${result.itemName}`,
      -result.price,
      result.newBalance,
    );
    shopBuyers.add(userId);
    await client.chat.postEphemeral({
      channel: userId,
      user: userId,
      text: `You bought *${result.itemName}* for $${result.price.toFixed(2)}.\nNew balance: $${result.newBalance.toFixed(2)}\n\n_Check /south-inventory to admire your questionable purchases._`,
    });
  } else if (actionType === "gift") {
    // Open gift modal with user picker
    const item = SHOP_ITEMS[itemId];
    if (!item) return;

    try {
      const giftView = {
        type: "modal",
        callback_id: "gift_modal",
        private_metadata: JSON.stringify({ itemId, senderId: userId }),
        title: { type: "plain_text", text: "Gift an Item" },
        submit: { type: "plain_text", text: "Send Gift" },
        close: { type: "plain_text", text: "Nevermind" },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${item.name}* — $${item.price.toFixed(2)}\n_This will be deducted from your balance._`,
            },
          },
          {
            type: "input",
            block_id: "recipient_block",
            element: {
              type: "users_select",
              action_id: "recipient",
              placeholder: { type: "plain_text", text: "Pick a victim" },
            },
            label: { type: "plain_text", text: "Recipient" },
          },
          {
            type: "input",
            block_id: "message_block",
            optional: true,
            element: {
              type: "plain_text_input",
              action_id: "gift_message",
              placeholder: {
                type: "plain_text",
                text: "Optional message (they probably won't appreciate it)",
              },
            },
            label: { type: "plain_text", text: "Message" },
          },
        ],
      };

      // If triggered from inside a modal, push onto the stack; otherwise open new
      if (body.view) {
        await client.views.push({
          trigger_id: body.trigger_id,
          view: giftView,
        });
      } else {
        await client.views.open({
          trigger_id: body.trigger_id,
          view: giftView,
        });
      }
    } catch (e) {
      console.error("Error opening gift modal:", e);
    }
  } else if (actionType === "buymulti") {
    const item = SHOP_ITEMS[itemId];
    if (!item) return;

    try {
      const buyMultiView = {
        type: "modal",
        callback_id: "buy_multi_modal",
        private_metadata: JSON.stringify({ itemId, userId }),
        title: { type: "plain_text", text: "Buy Multiple" },
        submit: { type: "plain_text", text: "Buy" },
        close: { type: "plain_text", text: "Nevermind" },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${item.name}* — $${item.price.toFixed(2)} each\n_Why buy one when you can regret buying many?_`,
            },
          },
          {
            type: "input",
            block_id: "quantity_block",
            element: {
              type: "number_input",
              action_id: "quantity",
              is_decimal_allowed: false,
              min_value: "1",
              max_value: "99",
              placeholder: { type: "plain_text", text: "How many?" },
            },
            label: { type: "plain_text", text: "Quantity" },
          },
        ],
      };

      if (body.view) {
        await client.views.push({
          trigger_id: body.trigger_id,
          view: buyMultiView,
        });
      } else {
        await client.views.open({
          trigger_id: body.trigger_id,
          view: buyMultiView,
        });
      }
    } catch (e) {
      console.error("Error opening buy multiple modal:", e);
    }
  } else if (actionType === "giftkevin") {
    const item = SHOP_ITEMS[itemId];
    if (!item) return;

    const result = await convex.mutation(api.shop.giftToKevin, {
      userId,
      itemId,
    });

    if (result.error === "insufficient") {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: `You can't afford to tribute Kevin. You have $${result.balance.toFixed(2)} and this costs $${result.price.toFixed(2)}. He'll remember this.`,
      });
      return;
    }
    if (result.error === "frozen") {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: "Your account is frozen. Kevin does not accept gifts from the frozen.",
      });
      return;
    }
    if (result.error) {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: `Error: ${result.error}`,
      });
      return;
    }

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      `Tribute to Kevin: ${result.itemName}`,
      -result.price,
      result.newBalance,
    );
    shopBuyers.add(userId);

    const kevinReactions = [
      "Kevin has acknowledged your offering. He did not smile.",
      "Kevin took it without a word. This is the best possible outcome.",
      "Kevin looked at it, looked at you, and walked away. Progress.",
      "Kevin's assistant placed it on The Pile. You don't ask about The Pile.",
      "Kevin nodded. You have never seen Kevin nod before. You feel strange.",
    ];
    const reaction =
      kevinReactions[Math.floor(Math.random() * kevinReactions.length)];

    try {
      await client.chat.postMessage({
        channel: ALLOWED_CHANNEL,
        text: `<@${userId}> has offered a *${result.itemName}* as tribute to Kevin.\n\n_${reaction}_`,
      });
    } catch (e) {
      console.error("Error posting Kevin tribute announcement:", e);
    }
  }
});

// Handle gift modal submission
app.view("gift_modal", async ({ view, ack, client }) => {
  const { itemId, senderId } = JSON.parse(view.private_metadata);
  const recipientId = view.state.values.recipient_block.recipient.selected_user;
  const giftMessage =
    view.state.values.message_block?.gift_message?.value || "";

  const result = await convex.mutation(api.shop.giftItem, {
    senderId,
    recipientId,
    itemId,
  });

  if (result.error === "self_gift") {
    await ack({
      response_action: "errors",
      errors: {
        recipient_block:
          "You can't gift yourself. That's just buying with extra steps.",
      },
    });
    return;
  }
  if (result.error === "no_recipient") {
    await ack({
      response_action: "errors",
      errors: { recipient_block: "That user doesn't have a Southbag account." },
    });
    return;
  }
  if (result.error === "insufficient") {
    await ack({
      response_action: "errors",
      errors: {
        recipient_block: `You can't afford this ($${result.price.toFixed(2)}). Balance: $${result.balance.toFixed(2)}.`,
      },
    });
    return;
  }
  if (result.error) {
    await ack({
      response_action: "errors",
      errors: { recipient_block: `Error: ${result.error}` },
    });
    return;
  }

  await ack();

  await notifyBalanceChange(
    client,
    convex,
    api,
    senderId,
    `Gift: ${result.itemName}`,
    -result.price,
    result.senderNewBalance,
  );
  shopBuyers.add(senderId);

  const announcement =
    GIFT_ANNOUNCEMENTS[itemId] || "Southbag Support has no comment.";
  const msgLine = giftMessage ? `\n_"${giftMessage}"_` : "";

  // Announce in the allowed channel
  try {
    await client.chat.postMessage({
      channel: ALLOWED_CHANNEL,
      text: `<@${senderId}> just gifted a *${result.itemName}* to <@${recipientId}>.${msgLine}\n\n_${announcement}_`,
    });
  } catch (e) {
    console.error("Error posting gift announcement:", e);
  }
});

// Handle buy multiple modal submission
app.view("buy_multi_modal", async ({ view, ack, client }) => {
  const { itemId, userId } = JSON.parse(view.private_metadata);
  const quantity = parseInt(
    view.state.values.quantity_block.quantity.value,
    10,
  );

  const result = await convex.mutation(api.shop.buyMultipleItems, {
    userId,
    itemId,
    quantity,
  });

  if (result.error === "insufficient") {
    await ack({
      response_action: "errors",
      errors: {
        quantity_block: `You can't afford ${quantity}x ($${result.price.toFixed(2)} total). Balance: $${result.balance.toFixed(2)}.`,
      },
    });
    return;
  }
  if (result.error === "frozen") {
    await ack({
      response_action: "errors",
      errors: { quantity_block: "Your account is frozen." },
    });
    return;
  }
  if (result.error) {
    await ack({
      response_action: "errors",
      errors: { quantity_block: `Error: ${result.error}` },
    });
    return;
  }

  await ack();

  await notifyBalanceChange(
    client,
    convex,
    api,
    userId,
    `Shop: ${result.itemName} x${result.quantity}`,
    -result.totalCost,
    result.newBalance,
  );
  shopBuyers.add(userId);
  await client.chat.postEphemeral({
    channel: userId,
    user: userId,
    text: `You bought *${result.quantity}x ${result.itemName}* for $${result.totalCost.toFixed(2)}.\nNew balance: $${result.newBalance.toFixed(2)}\n\n_${result.quantity} of the same thing. Bold strategy._`,
  });
});

// Handle shop modal closed without buying
app.view(
  { callback_id: "shop_browse", type: "view_closed" },
  async ({ view, ack, client }) => {
    await ack();
    const { userId } = JSON.parse(view.private_metadata);

    // If they bought something, don't charge
    if (shopBuyers.has(userId)) {
      shopBuyers.delete(userId);
      return;
    }

    // Charge window shopping fee
    const fee = 0.15;
    const newBal = await convex.mutation(api.accounts.chargeFee, {
      userId,
      amount: fee,
      description: "Window shopping fee — looking is not free",
    });

    if (newBal !== null) {
      await notifyBalanceChange(
        client,
        convex,
        api,
        userId,
        "Window shopping fee",
        -fee,
        newBal,
      );
      try {
        await client.chat.postEphemeral({
          channel: userId,
          user: userId,
          text: `You left the shop without buying anything. That'll be *$${fee.toFixed(2)}* for wasting our time.\n\n_Window shopping fee applied. New balance: $${newBal.toFixed(2)}_`,
        });
      } catch (e) {}
    }
  },
);

// --- Start ---
(async () => {
  await app.start();
  console.log("⚡ Southbag bot is running (Socket Mode)");
})();
