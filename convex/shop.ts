import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const SHOP_ITEMS: Record<string, { name: string; price: number; description: string }> = {
  blahaj: { name: "Blahaj", price: 49.99, description: "An IKEA shark. Southbag Support hates this. Buy it anyway." },
  fee_insurance: { name: "Fee Insurance", price: 99.99, description: "Covers your next fee. Probably. No guarantees." },
  kevins_briefcase: { name: "Kevin's Briefcase", price: 250.00, description: "Contents unknown. Kevin is watching." },
  office_light_bulb: { name: "Office Light Bulb", price: 5.00, description: "For the flickering light. You know the one." },
  incident_report: { name: "2019 Incident Report", price: 500.00, description: "Redacted. All of it. Worth every cent." },
  southbag_mug: { name: "Southbag Mug", price: 12.50, description: "Says 'I survived Southbag Support' on the side. The handle is broken." },
  kevins_parking_spot: { name: "Kevin's Parking Spot", price: 1000.00, description: "He doesn't know you have this. Yet." },
  kevins_stapler: { name: "Kevin's Stapler", price: 15.00, description: "Red. Do not touch. Kevin knows." },
  break_room_key: { name: "Break Room Key", price: 75.00, description: "The break room has been locked since 2019. Nobody knows why." },
  employee_handbook: { name: "Employee Handbook", price: 3.00, description: "400 pages. All of them say \"don't\"." },
  office_plant: { name: "Office Plant", price: 25.00, description: "It's fake. Everything here is fake." },
  motivational_poster: { name: "Motivational Poster", price: 8.00, description: "\"Hang in there\" but the cat fell off years ago." },
  kevins_voicemail: { name: "Kevin's Voicemail", price: 150.00, description: "47 seconds of breathing and then \"I know.\"" },
  fire_extinguisher: { name: "Fire Extinguisher", price: 40.00, description: "Expired in 2017. Still on the wall. Decorative." },
  parking_cone: { name: "Parking Cone", price: 2.00, description: "From the parking lot. Kevin's been looking for it." },
  server_rack_dust: { name: "Server Rack Dust", price: 0.50, description: "A small bag of dust from the server room. Vintage 2019." },
  complaint_form: { name: "Complaint Form", price: 10.00, description: "Pre-filled with \"denied\". Saves time." },
  kevins_tie: { name: "Kevin's Tie", price: 200.00, description: "He wore this to the 2019 holiday party. It has a stain." },
  ceiling_tile: { name: "Ceiling Tile", price: 1.00, description: "From above your desk. There's something written on the back. You can't read it." },
  security_badge: { name: "Expired Security Badge", price: 35.00, description: "Opens nothing. But it beeps when you tap it. Reassuring." },
  fluorescent_tube: { name: "Fluorescent Tube", price: 7.50, description: "Buzzes at a frequency that causes mild existential dread." },
  kevins_chair: { name: "Kevin's Office Chair", price: 2000.00, description: "Ergonomic. Heated. Sentient. It knows things." },
  kevins_password: { name: "Kevin's Password", price: 5000.00, description: "Written on a sticky note. You shouldn't have this." },
  water_cooler: { name: "Water Cooler", price: 30.00, description: "The one where rumours are born. Empty. Has been empty." },
  exit_sign: { name: "Exit Sign", price: 18.00, description: "It points the wrong way. Always has." },
  kevins_family_photo: { name: "Kevin's Family Photo", price: 350.00, description: "The frame is empty. Kevin says it's not." },
  broken_clock: { name: "Broken Clock", price: 6.00, description: "Stopped at 2:19 AM. The same time as the incident." },
  sticky_notes: { name: "Sticky Notes (Used)", price: 0.25, description: "Someone wrote \"HELP\" on all of them. In Kevin's handwriting." },
  office_key_card: { name: "Office Key Card (Floor 3)", price: 500.00, description: "There is no Floor 3. The elevator disagrees." },
  paper_shredder: { name: "Paper Shredder", price: 45.00, description: "Only shreds important documents. Refuses junk mail." },
  kevins_coffee_mug: { name: "Kevin's Coffee Mug", price: 85.00, description: "Always full. Always cold. Nobody refills it." },
  whiteboard_marker: { name: "Whiteboard Marker (Red)", price: 4.00, description: "Writes in a colour that doesn't exist on the spectrum." },
  desk_drawer_contents: { name: "Desk Drawer Contents", price: 20.00, description: "A sealed bag. Rattles. Do not open before 2027." },
  visitor_badge: { name: "Visitor Badge (Permanent)", price: 60.00, description: "Says \"VISITOR\" but the expiry date is \"never\". You live here now." },
  network_cable: { name: "Network Cable", price: 11.00, description: "Connected to something. Nobody knows what. Unplugging it causes screaming." },
  kevins_nameplate: { name: "Kevin's Nameplate", price: 750.00, description: "Solid brass. The name changes depending on who's reading it." },
  emergency_manual: { name: "Emergency Manual", price: 100.00, description: "Step 1: Don't panic. Step 2: Panic. Step 3: See Kevin. There is no Step 4." },
};

export const getItems = query({
  args: {},
  handler: async () => {
    return SHOP_ITEMS;
  },
});

export const getInventory = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return null;
    return account.inventory || [];
  },
});

export const buyItem = mutation({
  args: { userId: v.string(), itemId: v.string() },
  handler: async (ctx, args) => {
    const item = SHOP_ITEMS[args.itemId];
    if (!item) return { error: "invalid_item" };

    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };
    if (account.status === "frozen") return { error: "frozen" };

    if (account.balance < item.price) {
      return { error: "insufficient", balance: account.balance, price: item.price, itemName: item.name };
    }

    const now = Date.now();
    const newBalance = Math.round((account.balance - item.price) * 100) / 100;
    const inventory = account.inventory || [];
    inventory.push({ itemId: args.itemId, name: item.name, boughtAt: now });

    await ctx.db.patch(account._id, { balance: newBalance, inventory });
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "withdrawal",
      amount: -item.price,
      description: `Shop purchase: ${item.name}`,
      balanceAfter: newBalance,
      createdAt: now,
    });

    return { success: true, itemName: item.name, price: item.price, newBalance };
  },
});

export const buyMultipleItems = mutation({
  args: { userId: v.string(), itemId: v.string(), quantity: v.number() },
  handler: async (ctx, args) => {
    if (args.quantity < 1 || args.quantity > 99 || !Number.isInteger(args.quantity)) {
      return { error: "invalid_quantity" };
    }

    const item = SHOP_ITEMS[args.itemId];
    if (!item) return { error: "invalid_item" };

    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };
    if (account.status === "frozen") return { error: "frozen" };

    const totalCost = Math.round(item.price * args.quantity * 100) / 100;
    if (account.balance < totalCost) {
      return { error: "insufficient", balance: account.balance, price: totalCost, itemName: item.name };
    }

    const now = Date.now();
    const newBalance = Math.round((account.balance - totalCost) * 100) / 100;
    const inventory = account.inventory || [];
    for (let i = 0; i < args.quantity; i++) {
      inventory.push({ itemId: args.itemId, name: item.name, boughtAt: now + i });
    }

    await ctx.db.patch(account._id, { balance: newBalance, inventory });
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "withdrawal",
      amount: -totalCost,
      description: `Shop purchase: ${item.name} x${args.quantity}`,
      balanceAfter: newBalance,
      createdAt: now,
    });

    return { success: true, itemName: item.name, quantity: args.quantity, totalCost, newBalance };
  },
});

export const giftItem = mutation({
  args: { senderId: v.string(), recipientId: v.string(), itemId: v.string() },
  handler: async (ctx, args) => {
    if (args.senderId === args.recipientId) return { error: "self_gift" };

    const item = SHOP_ITEMS[args.itemId];
    if (!item) return { error: "invalid_item" };

    const sender = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.senderId))
      .first();
    if (!sender) return { error: "no_account" };
    if (sender.status === "frozen") return { error: "frozen" };

    const recipient = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.recipientId))
      .first();
    if (!recipient) return { error: "no_recipient" };

    if (sender.balance < item.price) {
      return { error: "insufficient", balance: sender.balance, price: item.price, itemName: item.name };
    }

    const now = Date.now();
    const newBalance = Math.round((sender.balance - item.price) * 100) / 100;

    const recipientInventory = recipient.inventory || [];
    recipientInventory.push({ itemId: args.itemId, name: item.name, boughtAt: now, giftedBy: args.senderId });

    await ctx.db.patch(sender._id, { balance: newBalance });
    await ctx.db.patch(recipient._id, { inventory: recipientInventory });

    await ctx.db.insert("transactions", {
      userId: args.senderId,
      type: "withdrawal",
      amount: -item.price,
      description: `Gift: ${item.name} to <@${args.recipientId}>`,
      balanceAfter: newBalance,
      createdAt: now,
    });

    return { success: true, itemName: item.name, price: item.price, senderNewBalance: newBalance };
  },
});

export const giftToKevin = mutation({
  args: { userId: v.string(), itemId: v.string() },
  handler: async (ctx, args) => {
    const item = SHOP_ITEMS[args.itemId];
    if (!item) return { error: "invalid_item" };

    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };
    if (account.status === "frozen") return { error: "frozen" };

    if (account.balance < item.price) {
      return { error: "insufficient", balance: account.balance, price: item.price, itemName: item.name };
    }

    const now = Date.now();
    const newBalance = Math.round((account.balance - item.price) * 100) / 100;

    await ctx.db.patch(account._id, { balance: newBalance });
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "withdrawal",
      amount: -item.price,
      description: `Tribute to Kevin: ${item.name}`,
      balanceAfter: newBalance,
      createdAt: now,
    });

    return { success: true, itemName: item.name, price: item.price, newBalance };
  },
});
