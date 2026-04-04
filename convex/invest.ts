import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const invest = mutation({
  args: { userId: v.string(), amount: v.number() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };
    if (account.status === "frozen") return { error: "frozen" };
    if (account.balance < args.amount) return { error: "insufficient", balance: account.balance };

    const active = await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (active) return { error: "already_invested" };

    const now = Date.now();
    const fee = Math.round(args.amount * 0.05 * 100) / 100;
    const invested = Math.round((args.amount - fee) * 100) / 100;
    const newBalance = Math.round((account.balance - args.amount) * 100) / 100;

    // Random multiplier between 0 (total loss) and 3x
    const roll = Math.random();
    let multiplier: number;
    if (roll < 0.20) multiplier = 0; // 20%: total loss
    else if (roll < 0.40) multiplier = Math.round((Math.random() * 0.5 + 0.1) * 100) / 100; // 20%: partial loss
    else if (roll < 0.70) multiplier = Math.round((Math.random() * 0.5 + 1.0) * 100) / 100; // 30%: small gain
    else if (roll < 0.90) multiplier = Math.round((Math.random() * 1.0 + 1.5) * 100) / 100; // 20%: good gain
    else multiplier = Math.round((Math.random() * 1.0 + 2.0) * 100) / 100; // 10%: great gain

    const maturesAt = now + 3600_000; // 1 hour

    await ctx.db.patch(account._id, { balance: newBalance });
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "fee",
      amount: -args.amount,
      description: "Investment deposit",
      balanceAfter: newBalance,
      createdAt: now,
    });

    await ctx.db.insert("investments", {
      userId: args.userId,
      amount: invested,
      multiplier,
      maturesAt,
      status: "active",
      createdAt: now,
    });

    return { success: true, invested, fee, newBalance, maturesAt };
  },
});

export const collect = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const investment = await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (!investment) return { error: "no_investment" };

    const now = Date.now();
    if (now < investment.maturesAt) {
      const remaining = Math.ceil((investment.maturesAt - now) / 60_000);
      return { error: "not_mature", remaining };
    }

    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };

    const payout = Math.round(investment.amount * investment.multiplier * 100) / 100;
    const newBalance = Math.round((account.balance + payout) * 100) / 100;
    const profit = Math.round((payout - investment.amount) * 100) / 100;
    const status = investment.multiplier === 0 ? "crashed" : "matured";

    await ctx.db.patch(account._id, { balance: newBalance });
    await ctx.db.patch(investment._id, { status });

    if (payout > 0) {
      await ctx.db.insert("transactions", {
        userId: args.userId,
        type: "deposit",
        amount: payout,
        description: `Investment ${status} (${investment.multiplier}x return)`,
        balanceAfter: newBalance,
        createdAt: now,
      });
    }

    return { success: true, invested: investment.amount, multiplier: investment.multiplier, payout, profit, newBalance, status };
  },
});

export const status = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const investment = await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (!investment) return null;
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((investment.maturesAt - now) / 60_000));
    return { amount: investment.amount, remaining, maturesAt: investment.maturesAt };
  },
});
