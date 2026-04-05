import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const JOB_LISTINGS = [
  { title: "Southbag Branch Greeter", salary: 150 },
  { title: "ATM Apology Writer", salary: 220 },
  { title: "Fee Explanation Specialist", salary: 80 },
  { title: "Complaint Ignorer", salary: 180 },
  { title: "Password Reset Denier", salary: 450 },
  { title: "Queue Extension Coordinator", salary: 200 },
  { title: "Hold Music DJ", salary: 900 },
  { title: "Overdraft Celebration Planner", salary: 120 },
  { title: "Terms & Conditions Lengthener", salary: 175 },
  { title: "Customer Disappointment Analyst", salary: 90 },
  { title: "Lobby Floor Starer", salary: 50 },
  { title: "Senior Vice President of Nothing", salary: 5000 },
  { title: "Chief Vibes Officer", salary: 1800 },
  { title: "Intern (Unpaid)", salary: 0.05 },
  { title: "Executive Paper Shredder", salary: 130 },
  { title: "Vibe Coder", salary: 600 },
  { title: "Blockchain Hallucination Engineer", salary: 2500 },
  { title: "Chief Apology Officer", salary: 3200 },
  { title: "Compliance Loophole Finder", salary: 1400 },
  { title: "Meeting About Meetings Coordinator", salary: 750 },
  { title: "Synergy Evangelist", salary: 1100 },
  { title: "Printer Jam Therapist", salary: 300 },
  { title: "Kevin's Personal Assistant", salary: 4500 },
  { title: "Nap Room Security Guard", salary: 400 },
  { title: "Email Signature Designer", salary: 650 },
  { title: "Office Plant Whisperer", salary: 200 },
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

    // Charge onboarding fees
    const uniformFee = 0.02;
    const commuteFee = 0.15;
    const deskRentalFee = 0.10;
    const kevinSupervisionSurcharge = 0.25;
    const totalFee = Math.round((uniformFee + commuteFee + deskRentalFee + kevinSupervisionSurcharge) * 100) / 100;
    const newBalance = Math.round((account.balance - totalFee) * 100) / 100;
    await ctx.db.patch(account._id, { balance: newBalance });
    const feeDetails = [
      { desc: "Uniform deposit fee", amount: uniformFee },
      { desc: "Commute fee", amount: commuteFee },
      { desc: "Desk rental fee", amount: deskRentalFee },
      { desc: "Kevin's supervision surcharge", amount: kevinSupervisionSurcharge },
    ];
    for (const fee of feeDetails) {
      await ctx.db.insert("transactions", {
        userId: args.userId,
        type: "fee",
        amount: -fee.amount,
        description: fee.desc,
        balanceAfter: newBalance,
        createdAt: now,
      });
    }

    return { success: true, title: job.title, salary: job.salary, uniformFee: totalFee };
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

    // Additional work deductions
    const workFees = [
      { desc: "Workplace amenities fee", amount: 0.50 },
      { desc: "Break room access charge", amount: 0.05 },
      { desc: "Kevin's morale assessment (2%)", amount: Math.round(pay * 0.02 * 100) / 100 },
    ];
    const totalWorkFees = workFees.reduce((sum, f) => sum + f.amount, 0);
    const net = Math.round((pay - tax - totalWorkFees) * 100) / 100;
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
    for (let i = 0; i < workFees.length; i++) {
      await ctx.db.insert("transactions", {
        userId: args.userId,
        type: "fee",
        amount: -workFees[i].amount,
        description: workFees[i].desc,
        balanceAfter: newBalance,
        createdAt: now + 2 + i,
      });
    }

    return { success: true, event, gross: pay, tax, workFees, net, newBalance, title: job.title, bonusType };
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
