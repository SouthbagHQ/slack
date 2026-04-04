import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const JOB_LISTINGS = [
  { title: "Southbag Branch Greeter", salary: 15 },
  { title: "ATM Apology Writer", salary: 22 },
  { title: "Fee Explanation Specialist", salary: 8 },
  { title: "Complaint Ignorer", salary: 12 },
  { title: "Password Reset Denier", salary: 30 },
  { title: "Queue Extension Coordinator", salary: 18 },
  { title: "Hold Music DJ", salary: 75 },
  { title: "Overdraft Celebration Planner", salary: 10 },
  { title: "Terms & Conditions Lengthener", salary: 14 },
  { title: "Customer Disappointment Analyst", salary: 6 },
  { title: "Lobby Floor Starer", salary: 3 },
  { title: "Senior Vice President of Nothing", salary: 500 },
  { title: "Chief Vibes Officer", salary: 120 },
  { title: "Intern (Unpaid)", salary: 0.01 },
  { title: "Executive Paper Shredder", salary: 11 },
  { title: "Vibe Coder", salary: 45 },
];

export const getJob = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const apply = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) return { error: "already_employed", title: existing.title };

    // Check they have an account
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };

    // Random job assignment
    const job = JOB_LISTINGS[Math.floor(Math.random() * JOB_LISTINGS.length)];
    const now = Date.now();

    await ctx.db.insert("jobs", {
      userId: args.userId,
      title: job.title,
      salary: job.salary,
      hiredAt: now,
      lastWorkedAt: 0,
    });

    // Charge a uniform fee
    const uniformFee = 0.02;
    const newBalance = Math.round((account.balance - uniformFee) * 100) / 100;
    await ctx.db.patch(account._id, { balance: newBalance });
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "fee",
      amount: -uniformFee,
      description: "Uniform deposit fee",
      balanceAfter: newBalance,
      createdAt: now,
    });

    return { success: true, title: job.title, salary: job.salary, uniformFee };
  },
});

export const work = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!job) return { error: "no_job" };

    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };

    const now = Date.now();
    const cooldown = 30 * 1000; // 30 seconds between shifts
    if (job.lastWorkedAt && now - job.lastWorkedAt < cooldown) {
      const remaining = Math.ceil((cooldown - (now - job.lastWorkedAt)) / 1000);
      return { error: "cooldown", remaining };
    }

    // Random work outcomes
    const roll = Math.random();
    let pay = job.salary;
    let event = "Completed a shift";
    let bonusType: string | null = null;

    if (roll < 0.03) {
      // Kevin's approval bonus
      pay = Math.round(pay * 5 * 100) / 100;
      event = "Kevin personally approved your overtime";
      bonusType = "kevin";
    } else if (roll < 0.10) {
      // Overtime bonus
      pay = Math.round(pay * 2.5 * 100) / 100;
      event = "Overtime bonus shift";
      bonusType = "overtime";
    } else if (roll < 0.18) {
      // Performance bonus
      pay = Math.round(pay * 1.75 * 100) / 100;
      event = "Performance bonus (someone noticed you exist)";
      bonusType = "performance";
    } else if (roll < 0.23) {
      // Tips
      const tip = Math.round((Math.random() * pay * 0.5 + 1) * 100) / 100;
      pay = Math.round((pay + tip) * 100) / 100;
      event = `Shift + tips ($${tip.toFixed(2)})`;
      bonusType = "tips";
    } else if (roll < 0.33) {
      // Docked pay
      pay = Math.round(pay * 0.3 * 100) / 100;
      event = "Pay docked (bad attitude)";
    } else if (roll < 0.38) {
      // Workplace incident — you owe money
      const fine = Math.round((Math.random() * 5 + 1) * 100) / 100;
      const fineBalance = Math.round((account.balance - fine) * 100) / 100;
      await ctx.db.patch(account._id, { balance: fineBalance });
      await ctx.db.patch(job._id, { lastWorkedAt: now });
      await ctx.db.insert("transactions", {
        userId: args.userId,
        type: "fee",
        amount: -fine,
        description: "Workplace incident fine",
        balanceAfter: fineBalance,
        createdAt: now,
      });
      return { success: true, event: "Workplace incident", pay: -fine, newBalance: fineBalance, title: job.title };
    }

    // Tax: 40% income tax
    const tax = Math.round(pay * 0.40 * 100) / 100;
    const net = Math.round((pay - tax) * 100) / 100;
    const newBalance = Math.round((account.balance + net) * 100) / 100;

    await ctx.db.patch(account._id, { balance: newBalance });
    await ctx.db.patch(job._id, { lastWorkedAt: now });

    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "deposit",
      amount: net,
      description: `Salary: ${job.title} (${event})`,
      balanceAfter: newBalance,
      createdAt: now,
    });
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "fee",
      amount: -tax,
      description: "Income tax (40%)",
      balanceAfter: newBalance,
      createdAt: now + 1,
    });

    return { success: true, event, gross: pay, tax, net, newBalance, title: job.title, bonusType };
  },
});

export const quit = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!job) return { error: "no_job" };

    const title = job.title;
    await ctx.db.delete(job._id);

    // Charge an exit interview fee
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (account) {
      const exitFee = 0.05;
      const newBalance = Math.round((account.balance - exitFee) * 100) / 100;
      await ctx.db.patch(account._id, { balance: newBalance });
      await ctx.db.insert("transactions", {
        userId: args.userId,
        type: "fee",
        amount: -exitFee,
        description: "Exit interview fee",
        balanceAfter: newBalance,
        createdAt: Date.now(),
      });
    }

    return { success: true, title };
  },
});
