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
