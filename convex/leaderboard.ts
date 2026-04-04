import { query } from "./_generated/server";

export const top = query({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("accounts").collect();
    accounts.sort((a, b) => b.balance - a.balance);
    const top10 = accounts.slice(0, 10);
    return top10.map((a, i) => ({
      rank: i + 1,
      userId: a.userId,
      balance: a.balance,
      status: a.status,
      tier: a.tier || "None",
    }));
  },
});

export const bottom = query({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("accounts").collect();
    accounts.sort((a, b) => a.balance - b.balance);
    const bottom10 = accounts.slice(0, 10);
    return bottom10.map((a, i) => ({
      rank: i + 1,
      userId: a.userId,
      balance: a.balance,
      status: a.status,
      tier: a.tier || "None",
    }));
  },
});
