import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { SHOP_ITEMS } from "./shop";

export const promoteToAdmin = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };
    await ctx.db.patch(account._id, { isAdmin: true });
    return { success: true };
  },
});

export const isAdmin = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    return account?.isAdmin === true;
  },
});

export const warn = mutation({
  args: { userId: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };
    const newStrikes = (account.strikes || 0) + 1;
    await ctx.db.patch(account._id, { strikes: newStrikes });
    return { success: true, strikes: newStrikes };
  },
});

export const ban = mutation({
  args: { 
    userId: v.string(), 
    reason: v.optional(v.string()),
    banExpiry: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };
    await ctx.db.patch(account._id, { 
      isBanned: true, 
      banReason: args.reason,
      banExpiry: args.banExpiry,
    });
    return { success: true };
  },
});

export const checkBan = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { banned: false };
    if (!account.isBanned) return { banned: false };
    return { 
      banned: true, 
      reason: account.banReason, 
      expiry: account.banExpiry,
    };
  },
});

export const grantAllShopItems = mutation({
  args: {
    userId: v.string(),
    maxBlahajs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };

    const now = Date.now();
    const maxBlahajs = Math.max(0, Math.floor(args.maxBlahajs ?? 1));
    const inventory = account.inventory || [];
    const newInventory = [];
    let blahajsKept = 0;
    let blahajsRemoved = 0;

    for (const item of inventory) {
      if (item.itemId === "blahaj") {
        if (blahajsKept < maxBlahajs) {
          newInventory.push(item);
          blahajsKept++;
        } else {
          blahajsRemoved++;
        }
      } else {
        newInventory.push(item);
      }
    }

    const existingItemIds = new Set(newInventory.map((item) => item.itemId));
    const grantedItems = [];
    let offset = 0;
    for (const [itemId, item] of Object.entries(SHOP_ITEMS)) {
      if (existingItemIds.has(itemId)) continue;
      newInventory.push({ itemId, name: item.name, boughtAt: now + offset });
      grantedItems.push(item.name);
      offset++;
    }

    await ctx.db.patch(account._id, { inventory: newInventory });

    return {
      success: true,
      userId: args.userId,
      granted: grantedItems.length,
      grantedItems,
      blahajsRemoved,
      blahajsKept: Math.min(maxBlahajs, newInventory.filter((item) => item.itemId === "blahaj").length),
      totalItems: newInventory.length,
    };
  },
});
