import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
