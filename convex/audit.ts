import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const audit = mutation({
  args: { userId: v.string(), targetId: v.string() },
  handler: async (ctx, args) => {
    if (args.userId === args.targetId) return { error: "self_audit" };

    const auditor = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!auditor) return { error: "no_account" };

    const fee = 0.25;
    if (auditor.balance < fee) return { error: "insufficient", balance: auditor.balance };

    const target = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.targetId))
      .first();
    if (!target) return { error: "no_target" };

    const now = Date.now();
    const newBalance = Math.round((auditor.balance - fee) * 100) / 100;
    await ctx.db.patch(auditor._id, { balance: newBalance });
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "fee",
      amount: -fee,
      description: `Audit fee (target: <@${args.targetId}>)`,
      balanceAfter: newBalance,
      createdAt: now,
    });

    // Get target's recent transactions
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.targetId))
      .order("desc")
      .take(5);

    return {
      success: true,
      fee,
      auditorNewBalance: newBalance,
      target: {
        userId: args.targetId,
        balance: target.balance,
        status: target.status,
        tier: target.tier || "None",
        accountNumber: target.accountNumber,
        recentTransactions: transactions.map(t => ({
          type: t.type,
          amount: t.amount,
          description: t.description,
        })),
      },
    };
  },
});
