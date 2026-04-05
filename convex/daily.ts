import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const claim = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };

    const now = Date.now();
    const cooldown = 86400000; // 24 hours

    if (account.lastDailyAt && now - account.lastDailyAt < cooldown) {
      const remaining = cooldown - (now - account.lastDailyAt);
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      return { error: "cooldown", remaining, message: `Try again in ${hours}h ${minutes}m` };
    }

    // 8% chance of bonus day
    const bonus = Math.random() < 0.08;
    const multiplier = bonus ? 10 : 1;

    // Random reward between $1.00 and $10.00
    const baseReward = Math.round((Math.random() * 9 + 1) * 100) / 100;
    const reward = Math.round(baseReward * multiplier * 100) / 100;
    const processingFee = 0.05;
    const clickSurcharge = 0.02;
    const fee = Math.round((processingFee + clickSurcharge) * 100) / 100;
    const net = Math.round((reward - fee) * 100) / 100;
    const newBalance = Math.round((account.balance + net) * 100) / 100;

    await ctx.db.patch(account._id, { balance: newBalance, lastDailyAt: now });

    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "deposit",
      amount: reward,
      description: bonus ? "Daily reward (BONUS DAY 5x!)" : "Daily reward",
      balanceAfter: Math.round((account.balance + reward) * 100) / 100,
      createdAt: now,
    });

    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "fee",
      amount: -processingFee,
      description: "Daily processing fee",
      balanceAfter: Math.round((account.balance + reward - processingFee) * 100) / 100,
      createdAt: now + 1,
    });

    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "fee",
      amount: -clickSurcharge,
      description: "Daily click surcharge",
      balanceAfter: newBalance,
      createdAt: now + 2,
    });

    return { success: true, reward, fee, processingFee, clickSurcharge, net, bonus, newBalance };
  },
});
