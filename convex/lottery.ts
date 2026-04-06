import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    ticketPrice: v.number(),
    maxNumber: v.number(),
    pickCount: v.number(),
    jackpot: v.number(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("lotteries", {
      name: args.name,
      ticketPrice: args.ticketPrice,
      maxNumber: args.maxNumber,
      pickCount: args.pickCount,
      jackpot: args.jackpot,
      status: "open",
      createdBy: args.createdBy,
      createdAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const getOpen = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("lotteries")
      .filter((q) => q.eq(q.field("status"), "open"))
      .first();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("lotteries").collect();
    return all.reverse();
  },
});

export const buyTicket = mutation({
  args: {
    userId: v.string(),
    lotteryId: v.id("lotteries"),
    numbers: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const lottery = await ctx.db.get(args.lotteryId);
    if (!lottery) return { error: "no_lottery" };
    if (lottery.status !== "open") return { error: "not_open" };

    // Validate numbers
    if (args.numbers.length !== lottery.pickCount) {
      return { error: "wrong_count", expected: lottery.pickCount, got: args.numbers.length };
    }
    const seen = new Set<number>();
    for (const n of args.numbers) {
      if (n < 1 || n > lottery.maxNumber) {
        return { error: "out_of_range", number: n, min: 1, max: lottery.maxNumber };
      }
      if (seen.has(n)) {
        return { error: "duplicate", number: n };
      }
      seen.add(n);
    }

    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };
    if (account.status === "frozen") return { error: "frozen" };
    if (account.balance < lottery.ticketPrice) {
      return { error: "insufficient", balance: account.balance, needed: lottery.ticketPrice };
    }

    const now = Date.now();
    const newBalance = Math.round((account.balance - lottery.ticketPrice) * 100) / 100;

    await ctx.db.patch(account._id, { balance: newBalance });
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "fee",
      amount: -lottery.ticketPrice,
      description: `Lottery ticket: ${lottery.name}`,
      balanceAfter: newBalance,
      createdAt: now,
    });

    await ctx.db.insert("lotteryTickets", {
      lotteryId: args.lotteryId,
      userId: args.userId,
      numbers: args.numbers,
      createdAt: now,
    });

    const newJackpot = Math.round((lottery.jackpot + lottery.ticketPrice) * 100) / 100;
    await ctx.db.patch(args.lotteryId, { jackpot: newJackpot });

    return {
      success: true,
      numbers: args.numbers,
      ticketPrice: lottery.ticketPrice,
      newBalance,
      jackpot: newJackpot,
    };
  },
});

export const draw = mutation({
  args: {
    lotteryId: v.id("lotteries"),
  },
  handler: async (ctx, args) => {
    const lottery = await ctx.db.get(args.lotteryId);
    if (!lottery) return { error: "no_lottery" };
    if (lottery.status !== "open") return { error: "not_open" };

    // Generate unique random winning numbers
    const winningNumbers: number[] = [];
    while (winningNumbers.length < lottery.pickCount) {
      const n = Math.floor(Math.random() * lottery.maxNumber) + 1;
      if (!winningNumbers.includes(n)) winningNumbers.push(n);
    }
    winningNumbers.sort((a, b) => a - b);

    const now = Date.now();
    const tickets = await ctx.db
      .query("lotteryTickets")
      .withIndex("by_lottery", (q) => q.eq("lotteryId", args.lotteryId))
      .collect();

    const totalTickets = tickets.length;

    if (totalTickets === 0) {
      await ctx.db.patch(args.lotteryId, {
        winningNumbers,
        status: "drawn",
        drawnAt: now,
      });
      return {
        winningNumbers,
        winnerId: null,
        jackpot: lottery.jackpot,
        matchCount: 0,
        totalTickets: 0,
        taxAmount: 0,
        netPayout: 0,
      };
    }

    // Find the ticket(s) with the most matches
    const winSet = new Set(winningNumbers);
    let bestMatch = 0;
    const ticketMatches: { ticket: typeof tickets[0]; matches: number }[] = [];

    for (const ticket of tickets) {
      const matches = ticket.numbers.filter((n) => winSet.has(n)).length;
      ticketMatches.push({ ticket, matches });
      if (matches > bestMatch) bestMatch = matches;
    }

    const topTickets = ticketMatches.filter((t) => t.matches === bestMatch);
    // Pick randomly among tied tickets
    const winner = topTickets[Math.floor(Math.random() * topTickets.length)];
    const winnerId = winner.ticket.userId;
    const matchCount = winner.matches;

    // Credit winner's account with jackpot
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", winnerId))
      .first();

    if (account) {
      const afterPayout = Math.round((account.balance + lottery.jackpot) * 100) / 100;
      await ctx.db.patch(account._id, { balance: afterPayout });

      await ctx.db.insert("transactions", {
        userId: winnerId,
        type: "deposit",
        amount: lottery.jackpot,
        description: `Lottery winner: ${lottery.name}`,
        balanceAfter: afterPayout,
        createdAt: now,
      });
    }

    await ctx.db.patch(args.lotteryId, {
      winningNumbers,
      winnerId,
      status: "drawn",
      drawnAt: now,
    });

    return {
      winningNumbers,
      winnerId,
      jackpot: lottery.jackpot,
      matchCount,
      totalTickets,
    };
  },
});

export const getTickets = query({
  args: {
    lotteryId: v.id("lotteries"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lotteryTickets")
      .withIndex("by_lottery", (q) => q.eq("lotteryId", args.lotteryId))
      .collect();
  },
});

export const getUserTickets = query({
  args: {
    userId: v.string(),
    lotteryId: v.id("lotteries"),
  },
  handler: async (ctx, args) => {
    const tickets = await ctx.db
      .query("lotteryTickets")
      .withIndex("by_lottery", (q) => q.eq("lotteryId", args.lotteryId))
      .collect();
    return tickets.filter((t) => t.userId === args.userId);
  },
});

export const cancel = mutation({
  args: {
    lotteryId: v.id("lotteries"),
  },
  handler: async (ctx, args) => {
    const lottery = await ctx.db.get(args.lotteryId);
    if (!lottery) return { error: "no_lottery" };
    if (lottery.status !== "open") return { error: "not_open" };

    const tickets = await ctx.db
      .query("lotteryTickets")
      .withIndex("by_lottery", (q) => q.eq("lotteryId", args.lotteryId))
      .collect();

    const now = Date.now();

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const account = await ctx.db
        .query("accounts")
        .withIndex("by_user", (q) => q.eq("userId", ticket.userId))
        .first();
      if (!account) continue;

      const newBalance = Math.round((account.balance + lottery.ticketPrice) * 100) / 100;

      await ctx.db.patch(account._id, { balance: newBalance });
      await ctx.db.insert("transactions", {
        userId: ticket.userId,
        type: "deposit",
        amount: lottery.ticketPrice,
        description: `Lottery refund: ${lottery.name}`,
        balanceAfter: newBalance,
        createdAt: now + i,
      });
    }

    await ctx.db.patch(args.lotteryId, { status: "cancelled" });

    return { cancelled: true, refunded: tickets.length };
  },
});
