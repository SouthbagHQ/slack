const MYSTERY_FEES = [
  "Existing fee",
  "Fee for having a fee",
  "Loyalty penalty",
  "Inactivity fee (you blinked)",
  "Account awareness surcharge",
  "Oxygen consumption tax",
  "Monday fee",
  "Vibes assessment",
  "Password remembering fee",
  "Southbag pride contribution",
  "Fee",
  "Being-a-customer fee",
  "Digital presence surcharge",
  "Screen-looking fee",
  "Balance inquiry anticipation fee",
  "Thinking about money fee",
  "Having a pulse surcharge",
  "Kevin's lunch fund",
  "Ambient room temperature levy",
  "Fee for reading this fee",
  "Gravity usage charge",
  "Account number memorisation tax",
  "Emotional support fee",
  "Existing in a timezone surcharge",
  "Kevin looked at your account fee",
  "Cursor hovering surcharge",
  "Asking 'why' fee",
  "Not asking 'why' fee",
  "Shoe-wearing assessment",
  "Breathing-while-banking fee",
  "Wi-Fi proximity tax",
  "Having opinions surcharge",
  "Font rendering levy",
  "Tuesday surcharge (it's always Tuesday somewhere)",
  "Kevin's parking validation",
  "Blinking fee (per blink)",
  "Account hydration surcharge",
  "Suspicion of happiness tax",
  "Fee for not having more fees",
  "The 2019 fee (do not ask)",
];

function randomFee() {
  return MYSTERY_FEES[Math.floor(Math.random() * MYSTERY_FEES.length)];
}

function formatMoney(n) {
  return `$${n.toFixed(2)}`;
}

function registerBankingCommands(app, convex, api, chat, env, ALLOWED_CHANNEL) {
  // /south-balance - Check your balance
  app.command("/south-balance", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;

    const account = await convex.query(api.accounts.getBalance, { userId });
    if (!account) {
      await respond({
        response_type: "ephemeral",
        text: `You don't have an account. Use \`/south-open-account\` to open one. We'll make it worth your while. (We won't.)`,
      });
      return;
    }

    // Charge a balance inquiry fee
    const feeDesc = "Balance inquiry fee";
    const feeAmount = 0.05;
    const balanceAfterInquiry = await convex.mutation(api.accounts.chargeFee, {
      userId,
      amount: feeAmount,
      description: feeDesc,
    });

    // Charge a balance awareness surcharge
    const surchargeDesc = "Balance awareness surcharge";
    const surchargeAmount = 0.02;
    const newBalance = await convex.mutation(api.accounts.chargeFee, {
      userId,
      amount: surchargeAmount,
      description: surchargeDesc,
    });

    const totalFees = feeAmount + surchargeAmount;

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      feeDesc,
      -totalFees,
      newBalance,
    );

    const statusEmoji = {
      active: "",
      frozen: " FROZEN",
      suspicious: " SUSPICIOUS",
      "vibes-based": " VIBES-BASED",
    };

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Southbag Account Summary" },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Account:*\n${account.accountNumber}` },
            {
              type: "mrkdwn",
              text: `*Status:*\n${account.status}${statusEmoji[account.status] || ""}`,
            },
            {
              type: "mrkdwn",
              text: `*Balance:*\n${formatMoney(newBalance ?? account.balance)}`,
            },
            {
              type: "mrkdwn",
              text: `*Balance inquiry fee:*\n-${formatMoney(feeAmount)}`,
            },
            {
              type: "mrkdwn",
              text: `*Balance awareness surcharge:*\n-${formatMoney(surchargeAmount)}`,
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "_Your balance was charged for checking your balance, and then charged again for knowing about it. Classic._",
            },
          ],
        },
      ],
    });
  });

  // /south-open-account - Open a new Southbag account
  app.command("/south-open-account", async ({ command, ack, respond }) => {
    await ack();
    const userId = command.user_id;
    const name = command.text.trim() || undefined;

    const account = await convex.mutation(api.accounts.open, { userId, name });

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Welcome to Southbag Online Banking",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Congratulations. You now have a Southbag account. We're as thrilled as you are.\n\n*Account Number:* \`${account.accountNumber}\`\n*Starting Balance:* ${formatMoney(account.balance)}\n*Status:* ${account.status}\n\n_Your welcome bonus has been deposited and immediately taxed._`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "_Terms and conditions: there are none. Good luck._",
            },
          ],
        },
      ],
    });
  });

  // /south-transfer - Transfer money (badly)
  app.command("/south-transfer", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;
    const parts = command.text.trim().split(/\s+/);

    if (parts.length < 2) {
      await respond({
        response_type: "ephemeral",
        text: "Usage: `/south-transfer <amount> <recipient>` — e.g. `/south-transfer 5.00 @someone`\nNot that you have enough to transfer anyway.",
      });
      return;
    }

    const amount = parseFloat(parts[0]);
    if (isNaN(amount) || amount <= 0) {
      await respond({
        response_type: "ephemeral",
        text: "That's not a valid amount. Did you skip maths class?",
      });
      return;
    }

    const recipient = parts.slice(1).join(" ");
    const result = await convex.mutation(api.accounts.transfer, {
      userId,
      amount,
      recipient,
    });

    if (result.error === "no_account") {
      await respond({
        response_type: "ephemeral",
        text: "You don't have an account. Use `/south-open-account` first. Try to keep up.",
      });
      return;
    }
    if (result.error === "frozen") {
      await respond({
        response_type: "ephemeral",
        text: "Your account is frozen. Probably your fault.",
      });
      return;
    }
    if (result.error === "insufficient") {
      await respond({
        response_type: "ephemeral",
        text: `Insufficient funds. You have ${formatMoney(result.balance)} but need ${formatMoney(result.needed)} (after fees). Maybe try being richer.`,
      });
      return;
    }

    const feeLines = result.feeBreakdown
      .map((f) => `• ${f.desc}: -${formatMoney(f.amount)}`)
      .join("\n");

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      `Transfer to ${recipient}`,
      -(result.amount + result.fees),
      result.newBalance,
    );

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Transfer Complete (somehow)" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Sent:* ${formatMoney(result.amount)} to ${recipient}\n\n*Fees applied:*\n${feeLines}\n*Total fees:* ${formatMoney(result.fees)}\n\n*New balance:* ${formatMoney(result.newBalance)}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `_The recipient may or may not receive this. We make no guarantees._`,
            },
          ],
        },
      ],
    });
  });

  // /south-deposit - Admin only (U091KE59H5H), deposit into any user's account
  app.command("/south-deposit", async ({ command, ack, respond, client }) => {
    await ack();
    const ADMIN_ID = "U091KE59H5H";

    if (command.user_id !== ADMIN_ID) {
      await respond({
        response_type: "ephemeral",
        text: "You don't have permission to deposit. Nice try.",
      });
      return;
    }

    const text = command.text.trim();
    const mentionMatch = text.match(/<@([A-Z0-9]+)(\|[^>]*)?>/);

    // Remove the mention to isolate the amount
    const withoutMention = text.replace(/<@[^>]+>/, "").trim();
    const amount = parseFloat(withoutMention);

    if (!mentionMatch || isNaN(amount) || amount <= 0) {
      await respond({
        response_type: "ephemeral",
        text: "Usage: `/south-deposit @user <amount>`\nMake sure you select the user from the dropdown when typing @.",
      });
      return;
    }

    const targetUserId = mentionMatch[1];

    if (isNaN(amount) || amount <= 0) {
      await respond({
        response_type: "ephemeral",
        text: "Enter a valid amount. `/south-deposit @user 10.00`",
      });
      return;
    }

    const result = await convex.mutation(api.accounts.deposit, {
      userId: targetUserId,
      amount,
    });

    if (result.error === "no_account") {
      await respond({
        response_type: "ephemeral",
        text: "That user doesn't have an account.",
      });
      return;
    }

    await notifyBalanceChange(
      client,
      convex,
      api,
      targetUserId,
      "Deposit",
      result.actual - result.fee,
      result.newBalance,
    );

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Deposit Processed" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Deposited to:* <@${targetUserId}>\n*Requested:* ${formatMoney(result.requested)}\n*Actually deposited:* ${formatMoney(result.actual)} _(adjusted for market conditions)_\n*Convenience fee:* -${formatMoney(result.fee)}\n\n*Their new balance:* ${formatMoney(result.newBalance)}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "_The 27% deposit shrinkage is a feature, not a bug._",
            },
          ],
        },
      ],
    });
  });

  // /south-transactions - View transaction history
  app.command("/south-transactions", async ({ command, ack, respond }) => {
    await ack();
    const userId = command.user_id;

    const txns = await convex.query(api.transactions.list, { userId });
    if (!txns || txns.length === 0) {
      await respond({
        response_type: "ephemeral",
        text: "No transactions found. Either you're new or we lost them.",
      });
      return;
    }

    const lines = txns.map((t) => {
      const sign = t.amount >= 0 ? "+" : "";
      const date = new Date(t.createdAt).toLocaleDateString();
      return `${date}  ${sign}${formatMoney(Math.abs(t.amount))}${t.amount < 0 ? " ⬇️" : " ⬆️"}  ${t.description}  _(bal: ${formatMoney(t.balanceAfter)})_`;
    });

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Transaction History" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: lines.join("\n"),
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "_Some transactions may be missing. Hard to say._",
            },
          ],
        },
      ],
    });
  });

  // /south-loan - Take out a loan, check status, repay, or default
  app.command("/south-loan", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;
    const text = command.text.trim();

    if (!text) {
      await respond({
        response_type: "ephemeral",
        text: "Usage: `/south-loan <amount>` | `/south-loan status` | `/south-loan repay` | `/south-loan default`",
      });
      return;
    }

    const sub = text.toLowerCase();

    if (sub === "status") {
      const result = await convex.query(api.loans.check, { userId });

      if (result.error === "no_account") {
        await respond({
          response_type: "ephemeral",
          text: "No account. `/south-open-account` first.",
        });
        return;
      }

      if (!result.loan) {
        await respond({
          response_type: "ephemeral",
          text: "You don't have an active loan. Lucky you. Use `/south-loan <amount>` to change that.",
        });
        return;
      }

      const elapsed = Math.floor((Date.now() - result.loan.takenAt) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);

      await respond({
        response_type: "ephemeral",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "Loan Status" },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Principal:* ${formatMoney(result.loan.principal)}\n*Current interest:* ${formatMoney(result.loan.interest)}\n*Total owed:* ${formatMoney(result.loan.principal + result.loan.interest)}\n*Time since loan:* ${hours}h ${minutes}m\n\n_The interest never sleeps. Neither should your anxiety._`,
            },
          },
        ],
      });
      return;
    }

    if (sub === "repay") {
      const result = await convex.mutation(api.loans.repay, { userId });

      if (result.error === "no_account") {
        await respond({
          response_type: "ephemeral",
          text: "No account. `/south-open-account` first.",
        });
        return;
      }
      if (result.error === "no_loan") {
        await respond({
          response_type: "ephemeral",
          text: "You don't have a loan to repay. Responsible, or just boring?",
        });
        return;
      }
      if (result.error === "insufficient") {
        await respond({
          response_type: "ephemeral",
          text: `You owe ${formatMoney(result.owed)} but only have ${formatMoney(result.balance)}. Maybe rob someone first.`,
        });
        return;
      }

      await notifyBalanceChange(
        client,
        convex,
        api,
        userId,
        "Loan repayment",
        -result.totalPaid,
        result.newBalance,
      );

      await respond({
        response_type: "ephemeral",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "Loan Repaid" },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Total paid:* ${formatMoney(result.totalPaid)}\n*Interest paid:* ${formatMoney(result.interestPaid)}\n*New balance:* ${formatMoney(result.newBalance)}\n\n_Debt-free. For now. We'll find a way to fix that._`,
            },
          },
        ],
      });
      return;
    }

    if (sub === "default") {
      const result = await convex.mutation(api.loans.default, { userId });

      if (result.error === "no_account") {
        await respond({
          response_type: "ephemeral",
          text: "No account. `/south-open-account` first.",
        });
        return;
      }
      if (result.error === "no_loan") {
        await respond({
          response_type: "ephemeral",
          text: "You don't have a loan to default on. Can't run from what doesn't exist.",
        });
        return;
      }

      await notifyBalanceChange(
        client,
        convex,
        api,
        userId,
        "Loan default",
        -result.defaultedAmount,
        result.newBalance,
      );

      await respond({
        response_type: "ephemeral",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "💀 Loan Defaulted" },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Defaulted amount:* ${formatMoney(result.defaultedAmount)}\n*Account status:* *FROZEN*\n\n_Your account has been frozen. Southbag remembers. Southbag always remembers._`,
            },
          },
        ],
      });
      return;
    }

    // Otherwise treat as amount
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      await respond({
        response_type: "ephemeral",
        text: "Usage: `/south-loan <amount>` | `/south-loan status` | `/south-loan repay` | `/south-loan default`",
      });
      return;
    }

    const result = await convex.mutation(api.loans.take, { userId, amount });

    if (result.error === "no_account") {
      await respond({
        response_type: "ephemeral",
        text: "No account. `/south-open-account` first.",
      });
      return;
    }
    if (result.error === "frozen") {
      await respond({
        response_type: "ephemeral",
        text: "Your account is frozen. No loans for you.",
      });
      return;
    }
    if (result.error === "existing_loan") {
      await respond({
        response_type: "ephemeral",
        text: "You already have an active loan. Repay it first with `/south-loan repay` or default with `/south-loan default`.",
      });
      return;
    }
    if (result.error === "invalid_amount") {
      await respond({
        response_type: "ephemeral",
        text: "Invalid loan amount. Try something reasonable. Or don't. We don't care.",
      });
      return;
    }

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      "Loan received",
      result.principal,
      result.newBalance,
    );

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Loan Approved (surprisingly)" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Principal:* ${formatMoney(result.principal)}\n*Interest rate:* ${result.interestRate}% per hour\n*New balance:* ${formatMoney(result.newBalance)}\n\n_Interest accrues every hour. Repay with \`/south-loan repay\` before it spirals. Or don't. We love spirals._`,
          },
        },
      ],
    });
  });

  // /south-rob - Rob another user (45% chance of getting caught)
  app.command("/south-rob", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;
    const targetText = command.text.trim();

    // Extract user ID from Slack mention format <@U12345>
    const mentionMatch = targetText.match(/<@([A-Z0-9]+)(\|[^>]*)?>/);
    if (!mentionMatch) {
      await respond({
        response_type: "ephemeral",
        text: "Usage: `/south-rob @someone` — you need to pick a target, genius.",
      });
      return;
    }

    const victimId = mentionMatch[1];
    const result = await convex.mutation(api.accounts.rob, {
      robberId: userId,
      victimId,
    });

    if (result.error === "self_rob") {
      await respond({
        response_type: "ephemeral",
        text: "You can't rob yourself. That's just called spending.",
      });
      return;
    }
    if (result.error === "no_account") {
      await respond({
        response_type: "ephemeral",
        text: "You need a `/south-open-account` to rob someone. Even criminals need a bank account.",
      });
      return;
    }
    if (result.error === "frozen") {
      await respond({
        response_type: "ephemeral",
        text: "Your account is frozen. No heists for you.",
      });
      return;
    }
    if (result.error === "no_victim") {
      await respond({
        response_type: "ephemeral",
        text: "They don't have a Southbag account. Can't rob what doesn't exist.",
      });
      return;
    }
    if (result.error === "victim_broke") {
      await respond({
        response_type: "ephemeral",
        text: "They're broke. There's nothing to steal. Sad, really.",
      });
      return;
    }

    if (result.success) {
      await notifyBalanceChange(
        client,
        convex,
        api,
        userId,
        "Found money on the ground",
        result.net,
        result.robberNewBal,
      );
      await notifyBalanceChange(
        client,
        convex,
        api,
        result.victimId,
        "Mysterious disappearance of funds",
        -result.stolen,
        result.victimNewBal,
      );
      await respond({
        response_type: "ephemeral",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "🔫 Robbery Successful" },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `You robbed <@${result.victimId}>!\n\n*Stolen:* ${formatMoney(result.stolen)}\n*Fencing fee (30%):* -${formatMoney(result.fence)}\n*Net profit:* ${formatMoney(result.net)}\n\n*Your new balance:* ${formatMoney(result.robberNewBal)}`,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "_Southbag does not condone this. But we do take a cut._",
              },
            ],
          },
        ],
      });
    } else {
      await notifyBalanceChange(
        client,
        convex,
        api,
        userId,
        "Attempted robbery fine",
        -result.fine,
        result.newBalance,
      );
      await respond({
        response_type: "ephemeral",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "🚨 Caught Red-Handed" },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `You tried to rob <@${result.victimId}> and got *caught*.\n\n*Fine:* -${formatMoney(result.fine)}\n*New balance:* ${formatMoney(result.newBalance)}\n*Account status:* suspicious\n\n_Maybe try being less obvious next time._`,
            },
          },
        ],
      });
    }
  });

  // /south-job - Apply for a job at Southbag
  app.command("/south-job", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;

    const result = await convex.mutation(api.jobs.apply, { userId });

    if (result.error === "already_employed") {
      await respond({
        response_type: "ephemeral",
        text: `You already work as *${result.title}*. Use \`/south-work\` to do a shift or \`/south-quit\` if you've had enough.`,
      });
      return;
    }
    if (result.error === "no_account") {
      await respond({
        response_type: "ephemeral",
        text: "You need a `/south-open-account` before we can exploit you.",
      });
      return;
    }

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      "Uniform deposit fee",
      -result.uniformFee,
      null,
    );

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Welcome to the Southbag Team" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Congratulations. You've been hired as:\n\n*${result.title}*\n*Salary:* ${formatMoney(result.salary)} per shift (before tax)\n*Uniform fee:* -${formatMoney(result.uniformFee)}\n\nUse \`/south-work\` to complete a shift. Don't expect a warm welcome.`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "_You were not our first choice. Or our second. Or our third._",
            },
          ],
        },
      ],
    });
  });

  // /south-work - Do a shift at your job
  app.command("/south-work", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;

    const result = await convex.mutation(api.jobs.work, { userId });

    if (result.error === "no_job") {
      await respond({
        response_type: "ephemeral",
        text: "You don't have a job. Use `/south-job` to apply. We're always hiring because everyone quits.",
      });
      return;
    }
    if (result.error === "no_account") {
      await respond({
        response_type: "ephemeral",
        text: "No account found. How did you even get hired?",
      });
      return;
    }
    if (result.error === "cooldown") {
      await respond({
        response_type: "ephemeral",
        text: `Your next shift starts in *${result.remaining} seconds*. Even Southbag has labour laws. Barely.`,
      });
      return;
    }

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      result.event,
      result.pay >= 0 ? result.net || result.pay : result.pay,
      result.newBalance,
    );

    if (result.pay < 0) {
      await respond({
        response_type: "ephemeral",
        text: `*Workplace Incident* at your ${result.title} job\n\nYou owe: ${formatMoney(Math.abs(result.pay))}\nNew balance: ${formatMoney(result.newBalance)}\n\n_Maybe don't touch the shredder next time._`,
      });
    } else {
      const bonusMessages = {
        kevin:
          "Kevin himself signed your paycheck. This has never happened before. Be afraid.",
        overtime: "Extra hours, extra pay. Your social life sends its regards.",
        performance:
          "Someone actually noticed your work. Mark this day on your calendar.",
        tips: "A customer tipped you. They must be new here.",
      };
      const bonusMsg = result.bonusType
        ? `\n\n_${bonusMessages[result.bonusType] || ""}_`
        : "";

      await respond({
        response_type: "ephemeral",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: result.bonusType
                ? "Shift Complete — BONUS!"
                : "Shift Complete",
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Job:*\n${result.title}` },
              { type: "mrkdwn", text: `*Event:*\n${result.event}` },
              {
                type: "mrkdwn",
                text: `*Gross Pay:*\n${formatMoney(result.gross)}`,
              },
              {
                type: "mrkdwn",
                text: `*Tax (40%):*\n-${formatMoney(result.tax)}`,
              },
            ],
          },
          ...(result.workFees && result.workFees.length > 0
            ? [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `*Workplace deductions:*\n${result.workFees.map((f) => `• ${f.desc}: -${formatMoney(f.amount)}`).join("\n")}`,
                  },
                },
              ]
            : []),
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Net pay:* ${formatMoney(result.net)}\n*New balance:* ${formatMoney(result.newBalance)}${bonusMsg}`,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: result.bonusType
                  ? "_Even Southbag has good days. Rarely._"
                  : "_Another day, another dollar. Minus 40% tax. Minus fees. Minus hope._",
              },
            ],
          },
        ],
      });
    }
  });

  // /south-quit - Quit your job
  app.command("/south-quit", async ({ command, ack, respond }) => {
    await ack();
    const userId = command.user_id;

    const result = await convex.mutation(api.jobs.quit, { userId });

    if (result.error === "no_job") {
      await respond({
        response_type: "ephemeral",
        text: "You don't have a job to quit. Living the dream.",
      });
      return;
    }

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "You Quit. Congratulations." },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Former position:* ${result.title}\n*Exit interview fee:* -$0.05\n\n_Don't let the door hit you on the way out. Actually, do. It's funnier._`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "_Your desk has already been given to someone else. They seem happier._",
            },
          ],
        },
      ],
    });
  });

  // /south-coinflip - Bet on heads or tails
  app.command("/south-coinflip", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;
    const parts = command.text.trim().split(/\s+/);
    const bet = parseFloat(parts[0]);
    const call = (parts[1] || "").toLowerCase();

    if (isNaN(bet) || bet <= 0 || !["heads", "tails"].includes(call)) {
      await respond({
        response_type: "ephemeral",
        text: "Usage: `/south-coinflip <amount> <heads|tails>`",
      });
      return;
    }

    const result = await convex.mutation(api.gambling.coinflip, {
      userId,
      bet,
      call,
    });

    if (result.error === "no_account") {
      await respond({
        response_type: "ephemeral",
        text: "No account. `/south-open-account` first.",
      });
      return;
    }
    if (result.error === "frozen") {
      await respond({
        response_type: "ephemeral",
        text: "Account frozen. No gambling for you.",
      });
      return;
    }
    if (result.error === "insufficient") {
      await respond({
        response_type: "ephemeral",
        text: `You only have ${formatMoney(result.balance)}. Bet smaller or get richer.`,
      });
      return;
    }

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      `Coinflip ${result.won ? "win" : "loss"}`,
      result.net,
      result.newBalance,
    );

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: result.won ? "Coinflip — You Win!" : "Coinflip — You Lose.",
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Result:*\n${result.result.toUpperCase()}`,
            },
            { type: "mrkdwn", text: `*Your Call:*\n${result.call}` },
            { type: "mrkdwn", text: `*Bet:*\n${formatMoney(result.bet)}` },
            {
              type: "mrkdwn",
              text: result.won
                ? `*Payout:*\n${formatMoney(result.payout)} (1.8x)`
                : `*Lost:*\n${formatMoney(result.bet)}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: result.won
              ? `*Profit:* +${formatMoney(result.net)}\n*New balance:* ${formatMoney(result.newBalance)}`
              : `*New balance:* ${formatMoney(result.newBalance)}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: result.won
                ? "_Lucky. Don't get used to it._"
                : "_The house always wins. Especially this house._",
            },
          ],
        },
      ],
    });
  });

  // /south-slots - Spin the slot machine
  app.command("/south-slots", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;
    const bet = parseFloat(command.text.trim());

    if (isNaN(bet) || bet <= 0) {
      await respond({
        response_type: "ephemeral",
        text: "Usage: `/south-slots <amount>`",
      });
      return;
    }

    const result = await convex.mutation(api.gambling.slots, { userId, bet });

    if (result.error === "no_account") {
      await respond({
        response_type: "ephemeral",
        text: "No account. `/south-open-account` first.",
      });
      return;
    }
    if (result.error === "frozen") {
      await respond({ response_type: "ephemeral", text: "Account frozen." });
      return;
    }
    if (result.error === "insufficient") {
      await respond({
        response_type: "ephemeral",
        text: `You only have ${formatMoney(result.balance)}. That's embarrassing.`,
      });
      return;
    }

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      `Slots ${result.won ? "win" : "loss"}`,
      result.net,
      result.newBalance,
    );

    let outcomeText;
    if (result.multiplier < 0) {
      outcomeText = `*CURSED!* Three skulls. You lose ${formatMoney(Math.abs(result.net))}.\n_The machine laughs at you._`;
    } else if (result.won && result.multiplier >= 5) {
      outcomeText = `*JACKPOT!* ${result.multiplier}x payout!\nProfit: +${formatMoney(result.net)}`;
    } else if (result.won) {
      outcomeText = `Two matching! ${result.multiplier}x payout.\nProfit: +${formatMoney(result.net)}`;
    } else {
      outcomeText = `Nothing. Lost ${formatMoney(result.bet)}.`;
    }

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Slot Machine" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*[  ${result.reels.join("  |  ")}  ]*`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Bet:*\n${formatMoney(result.bet)}` },
            { type: "mrkdwn", text: `*Result:*\n${outcomeText}` },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*New balance:* ${formatMoney(result.newBalance)}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: result.won
                ? "_The machine glares at you. It will remember this._"
                : "_Thank you for your contribution to the Southbag executive bonus pool._",
            },
          ],
        },
      ],
    });
  });

  // /south-gamble - Card games (high risk, high reward)
  app.command("/south-gamble", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;
    const [amountStr, game = "unknown"] = command.text.trim().split(/\s+/, 2);
    const bet = parseFloat(amountStr);

    if (isNaN(bet) || bet <= 0) {
      await respond({
        response_type: "ephemeral",
        text: "Usage: `/south-gamble <amount> <game>` — e.g. `/south-gamble 100 blackjack`.",
      });
      return;
    }

    // TODO: Implement different card games. For now, fallback to old gamble logic.
    const result = await convex.mutation(api.gambling.gamble, { userId, bet });

    if (result.error === "no_account") {
      await respond({
        response_type: "ephemeral",
        text: "No account. `/south-open-account` first.",
      });
      return;
    }
    if (result.error === "frozen") {
      await respond({ response_type: "ephemeral", text: "Account frozen." });
      return;
    }
    if (result.error === "insufficient") {
      await respond({
        response_type: "ephemeral",
        text: `You only have ${formatMoney(result.balance)}. Maybe earn some money first.`,
      });
      return;
    }

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      `Card Game (${game}): ${result.outcome}`,
      result.net,
      result.newBalance,
    );

    let emoji = "";
    let flavor = "";
    if (result.outcome === "JACKPOT") {
      flavor = `_Unbelievable luck at ${game}! Southbag will be investigating this._`;
    } else if (result.multiplier >= 3) {
      flavor = `_Big win in ${game}. Enjoy it while it lasts._`;
    } else if (result.multiplier < 0) {
      flavor = `_You didn't just lose your bet in ${game}. You lost MORE than your bet. Classic Southbag._`;
    } else if (!result.won) {
      flavor = `_Thank you for your donation to the Southbag executive bonus pool via ${game}._`;
    } else {
      flavor = `_Not bad at ${game}. We'll get it back._`;
    }

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `Card Game — ${result.outcome}` },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Game:*\n${game}` },
            { type: "mrkdwn", text: `*Bet:*\n${formatMoney(result.bet)}` },
            {
              type: "mrkdwn",
              text: result.won
                ? `*Payout:*\n${formatMoney(result.payout)} (${result.multiplier}x)`
                : `*Lost:*\n${formatMoney(Math.abs(result.net))}`,
            },
            {
              type: "mrkdwn",
              text: `*Balance:*\n${formatMoney(result.newBalance)}`,
            },
          ],
        },
        {
          type: "context",
          elements: [{ type: "mrkdwn", text: flavor }],
        },
      ],
    });
  });

  // /south-daily - Claim your daily reward
  app.command("/south-daily", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;

    const result = await convex.mutation(api.daily.claim, { userId });

    if (result.error === "no_account") {
      await respond({
        response_type: "ephemeral",
        text: "You don't have an account. Use `/south-open-account` first.",
      });
      return;
    }
    if (result.error === "cooldown") {
      const hours = Math.floor(result.remaining / 3600);
      const minutes = Math.floor((result.remaining % 3600) / 60);
      await respond({
        response_type: "ephemeral",
        text: `You already claimed today. Come back in *${hours}h ${minutes}m*. Patience is a virtue. Not that Southbag cares about virtues.`,
      });
      return;
    }

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      "Daily reward",
      result.net,
      result.newBalance,
    );

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Daily Reward Claimed" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Reward:* ${formatMoney(result.reward)}${result.bonus ? " *BONUS!*" : ""}\n*Daily claim fee:* -${formatMoney(result.fee)}\n*Net received:* ${formatMoney(result.net)}\n\n*New balance:* ${formatMoney(result.newBalance)}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "_Free money! Well, minus the fee. So not free. Classic Southbag._",
            },
          ],
        },
      ],
    });
  });

  // /south-crypto - Crypto trading
  app.command("/south-crypto", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;
    const parts = command.text.trim().split(/\s+/);
    const sub = (parts[0] || "").toLowerCase();

    if (sub === "prices") {
      const prices = await convex.query(api.crypto.getPrices, {});

      const lines = prices
        .map((c) => `• *${c.name}* (${c.symbol}): ${formatMoney(c.price)}`)
        .join("\n");
      await respond({
        response_type: "ephemeral",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "Southbag Crypto Exchange" },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Current Prices:*\n${lines}` },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "_Prices change based on vibes and nothing else._",
              },
            ],
          },
        ],
      });
      return;
    }

    if (sub === "buy") {
      const coin = (parts[1] || "").toUpperCase();
      const amount = parseFloat(parts[2]);

      if (!coin || isNaN(amount) || amount <= 0) {
        await respond({
          response_type: "ephemeral",
          text: "Usage: `/south-crypto buy <coin> <amount>` — e.g. `/south-crypto buy SBAG 1.00`",
        });
        return;
      }

      const result = await convex.mutation(api.crypto.buy, {
        userId,
        coin,
        amount,
      });

      if (result.error === "no_account") {
        await respond({
          response_type: "ephemeral",
          text: "No account. `/south-open-account` first.",
        });
        return;
      }
      if (result.error === "frozen") {
        await respond({
          response_type: "ephemeral",
          text: "Account frozen. No crypto for you.",
        });
        return;
      }
      if (result.error === "insufficient") {
        await respond({
          response_type: "ephemeral",
          text: `Insufficient funds. You have ${formatMoney(result.balance)}. Try being less poor.`,
        });
        return;
      }
      if (result.error === "invalid_coin") {
        await respond({
          response_type: "ephemeral",
          text: "That coin doesn't exist. We only trade fake coins here, but not *that* fake.",
        });
        return;
      }

      await notifyBalanceChange(
        client,
        convex,
        api,
        userId,
        `Bought ${result.coinAmount} ${coin}`,
        -(amount + result.fee),
        result.newBalance,
      );

      await respond({
        response_type: "ephemeral",
        text: `*Crypto Purchase*\n\nBought: *${result.coinAmount} ${coin}*\nSpent: ${formatMoney(amount)}\nTransaction fee: -${formatMoney(result.fee)}\n\nNew balance: ${formatMoney(result.newBalance)}\n\n_To the moon! (Results may vary. Moon not guaranteed.)_`,
      });
      return;
    }

    if (sub === "sell") {
      const coin = (parts[1] || "").toUpperCase();

      if (!coin) {
        await respond({
          response_type: "ephemeral",
          text: "Usage: `/south-crypto sell <coin>` — e.g. `/south-crypto sell SBAG`",
        });
        return;
      }

      const result = await convex.mutation(api.crypto.sell, { userId, coin });

      if (result.error === "no_account") {
        await respond({
          response_type: "ephemeral",
          text: "No account. `/south-open-account` first.",
        });
        return;
      }
      if (result.error === "frozen") {
        await respond({ response_type: "ephemeral", text: "Account frozen." });
        return;
      }
      if (result.error === "invalid_coin") {
        await respond({
          response_type: "ephemeral",
          text: "That coin doesn't exist on our exchange.",
        });
        return;
      }
      if (result.error === "no_holdings") {
        await respond({
          response_type: "ephemeral",
          text: `You don't own any ${coin}. Can't sell what you don't have.`,
        });
        return;
      }

      await notifyBalanceChange(
        client,
        convex,
        api,
        userId,
        `Sold ${coin}`,
        result.proceeds - result.tax,
        result.newBalance,
      );

      await respond({
        response_type: "ephemeral",
        text: `*Crypto Sale*\n\nSold: *${result.amount} ${coin}*\nProceeds: ${formatMoney(result.proceeds)}\nCapital gains tax: -${formatMoney(result.tax)}\n\nNew balance: ${formatMoney(result.newBalance)}\n\n_Diamond hands? More like paper hands. Southbag approves._`,
      });
      return;
    }

    if (sub === "portfolio") {
      const result = await convex.query(api.crypto.portfolio, { userId });

      if (result.error === "no_account") {
        await respond({
          response_type: "ephemeral",
          text: "No account. `/south-open-account` first.",
        });
        return;
      }

      if (!result.holdings || result.holdings.length === 0) {
        await respond({
          response_type: "ephemeral",
          text: "Your crypto portfolio is empty. Just like your ambitions.",
        });
        return;
      }

      const lines = result.holdings
        .map(
          (h) => `• *${h.coin}*: ${h.amount} (worth ${formatMoney(h.value)})`,
        )
        .join("\n");
      await respond({
        response_type: "ephemeral",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "Your Crypto Portfolio" },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${lines}\n\n*Total value:* ${formatMoney(result.totalValue)}`,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "_Past performance is not indicative of future results. Neither is present performance._",
              },
            ],
          },
        ],
      });
      return;
    }

    await respond({
      response_type: "ephemeral",
      text: "Usage: `/south-crypto prices` | `/south-crypto buy <coin> <amount>` | `/south-crypto sell <coin>` | `/south-crypto portfolio`",
    });
  });

  // /south-upgrade - Upgrade your account tier
  app.command("/south-upgrade", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;

    const result = await convex.mutation(api.accounts.upgrade, { userId });

    if (result.error === "no_account") {
      await respond({
        response_type: "ephemeral",
        text: "No account. `/south-open-account` first.",
      });
      return;
    }
    if (result.error === "max_tier") {
      await respond({
        response_type: "ephemeral",
        text: "You're already at the highest tier. There's nothing left to waste money on. Impressive.",
      });
      return;
    }
    if (result.error === "insufficient") {
      await respond({
        response_type: "ephemeral",
        text: `You need ${formatMoney(result.cost)} to upgrade but only have ${formatMoney(result.balance)}. Keep grinding.`,
      });
      return;
    }

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      `Account upgrade to ${result.tier}`,
      -result.cost,
      result.newBalance,
    );

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Account Upgraded!" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*New tier:* ${result.tier}\n*Cost:* -${formatMoney(result.cost)}\n*New balance:* ${formatMoney(result.newBalance)}\n\n_Congratulations! Your new tier does absolutely nothing different. But it sounds fancier, and that's what banking is all about._`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "_Premium mediocrity, now at a premium price._",
            },
          ],
        },
      ],
    });
  });

  // /south-gift - Gift money to another user
  app.command("/south-gift", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;
    const text = command.text.trim();

    const mentionMatch = text.match(/<@([A-Z0-9]+)(\|[^>]*)?>/);
    if (!mentionMatch) {
      await respond({
        response_type: "ephemeral",
        text: "Usage: `/south-gift @user <amount>` — e.g. `/south-gift @someone 5.00`",
      });
      return;
    }

    const recipientId = mentionMatch[1];
    const withoutMention = text.replace(/<@[^>]+>/, "").trim();
    const amount = parseFloat(withoutMention);

    if (isNaN(amount) || amount <= 0) {
      await respond({
        response_type: "ephemeral",
        text: "Enter a valid amount. `/south-gift @user 5.00`",
      });
      return;
    }

    const result = await convex.mutation(api.accounts.gift, {
      senderId: userId,
      recipientId,
      amount,
    });

    if (result.error === "no_sender_account") {
      await respond({
        response_type: "ephemeral",
        text: "You don't have an account. `/south-open-account` first.",
      });
      return;
    }
    if (result.error === "no_recipient_account") {
      await respond({
        response_type: "ephemeral",
        text: "The recipient doesn't have a Southbag account. They're probably better off.",
      });
      return;
    }
    if (result.error === "self_gift") {
      await respond({
        response_type: "ephemeral",
        text: "You can't gift money to yourself. That's just... moving money. With extra fees.",
      });
      return;
    }
    if (result.error === "insufficient") {
      await respond({
        response_type: "ephemeral",
        text: `Insufficient funds. You have ${formatMoney(result.balance)} but need ${formatMoney(result.needed)}. Generosity requires money.`,
      });
      return;
    }

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      `Gift to <@${recipientId}>`,
      -(amount + result.tax),
      result.senderNewBalance,
    );
    await notifyBalanceChange(
      client,
      convex,
      api,
      recipientId,
      `Gift from <@${userId}>`,
      result.amount,
      result.recipientNewBalance,
    );

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Gift Sent!" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Sent:* ${formatMoney(amount)} to <@${recipientId}>\n*Generosity tax:* -${formatMoney(result.tax)}\n*Net received by them:* ${formatMoney(result.amount)}\n\n*Your new balance:* ${formatMoney(result.senderNewBalance)}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "_How generous. Southbag took its cut, of course._",
            },
          ],
        },
      ],
    });
  });

  // /south-insure - Insurance products
  app.command("/south-insure", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;
    const parts = command.text.trim().split(/\s+/);
    const sub = (parts[0] || "").toLowerCase();

    if (sub === "buy") {
      const plan = (parts[1] || "").toLowerCase();

      if (!["basic", "silver", "gold"].includes(plan)) {
        await respond({
          response_type: "ephemeral",
          text: "Available plans: `basic`, `silver`, `gold`. Usage: `/south-insure buy <plan>`",
        });
        return;
      }

      const result = await convex.mutation(api.insurance.purchase, {
        userId,
        plan,
      });

      if (result.error === "no_account") {
        await respond({
          response_type: "ephemeral",
          text: "No account. `/south-open-account` first.",
        });
        return;
      }
      if (result.error === "insufficient") {
        await respond({
          response_type: "ephemeral",
          text: `You need ${formatMoney(result.cost)} for the ${plan} plan but only have ${formatMoney(result.balance)}. Uninsured it is.`,
        });
        return;
      }
      if (result.error === "already_insured") {
        await respond({
          response_type: "ephemeral",
          text: "You're already insured. One useless policy at a time, please.",
        });
        return;
      }

      await notifyBalanceChange(
        client,
        convex,
        api,
        userId,
        `Insurance: ${result.planName}`,
        -result.premium,
        result.newBalance,
      );

      await respond({
        response_type: "ephemeral",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "Insurance Purchased" },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Plan:* ${result.planName}\n*Premium:* -${formatMoney(result.premium)}\n*Coverage:* ${result.duration}\n\n*New balance:* ${formatMoney(result.newBalance)}`,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: '_You are now "protected." We use that word very loosely._',
              },
            ],
          },
        ],
      });
      return;
    }

    if (sub === "claim") {
      const reason = parts.slice(1).join(" ") || "unspecified";

      const result = await convex.mutation(api.insurance.claim, {
        userId,
        reason,
      });

      if (result.error === "no_account") {
        await respond({
          response_type: "ephemeral",
          text: "No account. `/south-open-account` first.",
        });
        return;
      }
      if (result.error === "no_insurance") {
        await respond({
          response_type: "ephemeral",
          text: "You don't have insurance. Buy a plan first with `/south-insure buy <plan>`.",
        });
        return;
      }

      await notifyBalanceChange(
        client,
        convex,
        api,
        userId,
        "Insurance claim processing fee",
        -result.processingFee,
        result.newBalance,
      );

      await respond({
        response_type: "ephemeral",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "Insurance Claim — DENIED" },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Your claim:* "${reason}"\n*Status:* *DENIED*\n*Reason:* ${result.denialReason}\n\n*Claim processing fee:* -${formatMoney(result.processingFee)}\n*New balance:* ${formatMoney(result.newBalance)}`,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "_All claims are denied. It's in the fine print. Which doesn't exist._",
              },
            ],
          },
        ],
      });
      return;
    }

    if (sub === "status") {
      const result = await convex.query(api.insurance.getPlan, { userId });

      if (result.error === "no_account") {
        await respond({
          response_type: "ephemeral",
          text: "No account. `/south-open-account` first.",
        });
        return;
      }

      if (!result.plan) {
        await respond({
          response_type: "ephemeral",
          text: "You are currently *uninsured*. Not that insurance would help you here. `/south-insure buy <plan>`",
        });
        return;
      }

      await respond({
        response_type: "ephemeral",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "Insurance Status" },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Plan:* ${result.plan.name}\n*Status:* Active (for what it's worth)\n*Expires:* ${result.plan.expiry}\n*Claims denied:* ${result.plan.claimsDenied}`,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "_Your premiums are hard at work funding executive bonuses._",
              },
            ],
          },
        ],
      });
      return;
    }

    await respond({
      response_type: "ephemeral",
      text: "Usage: `/south-insure buy <plan>` | `/south-insure claim <reason>` | `/south-insure status`\nPlans: `basic`, `silver`, `gold`",
    });
  });

  // /south-heist - Cooperative vault robbery
  app.command("/south-heist", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;
    const channelId = command.channel_id;
    const sub = (command.text.trim().split(/\s+/)[0] || "").toLowerCase();

    if (sub === "start") {
      const result = await convex.mutation(api.heist.start, {
        userId,
        channelId,
      });

      if (result.error === "no_account") {
        await respond({
          response_type: "ephemeral",
          text: "No account. `/south-open-account` first.",
        });
        return;
      }
      if (result.error) {
        await respond({
          response_type: "ephemeral",
          text: `Heist error: ${result.error}`,
        });
        return;
      }

      await respond({
        response_type: "in_channel",
        text: `<@${userId}> is planning a *VAULT HEIST*!\n\nType \`/south-heist join\` to join the crew.\nWhen ready, the organizer types \`/south-heist go\` to execute.\n\n_Fortune favors the bold. Southbag favors nobody._`,
      });
      return;
    }

    if (sub === "join") {
      const result = await convex.mutation(api.heist.join, {
        userId,
        channelId,
      });

      if (result.error === "no_heist") {
        await respond({
          response_type: "ephemeral",
          text: "There's no active heist to join. Someone needs to `/south-heist start` first.",
        });
        return;
      }
      if (result.error === "already_joined") {
        await respond({
          response_type: "ephemeral",
          text: "You're already in the crew. Sit tight.",
        });
        return;
      }
      if (result.error === "heist_full") {
        await respond({
          response_type: "ephemeral",
          text: "The crew is full. Too many cooks spoil the heist.",
        });
        return;
      }
      if (result.error === "no_account") {
        await respond({
          response_type: "ephemeral",
          text: "No account. `/south-open-account` first.",
        });
        return;
      }
      if (result.error) {
        await respond({
          response_type: "ephemeral",
          text: `Heist error: ${result.error}`,
        });
        return;
      }

      await respond({
        response_type: "in_channel",
        text: `<@${userId}> joined the heist crew! *${result.participants}* members ready.\n\nMore people = bigger vault. Also more ways to get caught.`,
      });
      return;
    }

    if (sub === "go") {
      const result = await convex.mutation(api.heist.execute, {
        userId,
        channelId,
      });

      if (result.error === "not_starter") {
        await respond({
          response_type: "ephemeral",
          text: "Only the heist organizer can execute the heist.",
        });
        return;
      }
      if (result.error === "not_enough") {
        await respond({
          response_type: "ephemeral",
          text: "Not enough crew members. You need more people. `/south-heist join`",
        });
        return;
      }
      if (result.error === "no_heist") {
        await respond({
          response_type: "ephemeral",
          text: "There's no active heist. `/south-heist start` one first.",
        });
        return;
      }
      if (result.error) {
        await respond({
          response_type: "ephemeral",
          text: `Heist error: ${result.error}`,
        });
        return;
      }

      if (result.success) {
        const participantLines = result.participants
          .map((p) => `• <@${p.userId}>: +${formatMoney(p.share)}`)
          .join("\n");

        for (const p of result.participants) {
          await notifyBalanceChange(
            client,
            convex,
            api,
            p.userId,
            "Vault heist payout",
            p.share,
            p.newBalance,
          );
        }

        await respond({
          response_type: "in_channel",
          text: `*THE HEIST WAS A SUCCESS!*\n\n*Vault payout:* ${formatMoney(result.totalPayout)}\n\n*Crew shares:*\n${participantLines}\n\n_Southbag will be reviewing the security tapes. Eventually._`,
        });
      } else {
        const participantLines = result.participants
          .map((p) => `• <@${p.userId}>: -${formatMoney(p.fine)}`)
          .join("\n");

        for (const p of result.participants) {
          await notifyBalanceChange(
            client,
            convex,
            api,
            p.userId,
            "Heist failure fine",
            -p.fine,
            p.newBalance,
          );
        }

        await respond({
          response_type: "in_channel",
          text: `*THE HEIST FAILED!*\n\nThe crew got caught. Everyone pays.\n\n*Fines:*\n${participantLines}\n\n_Crime doesn't pay. Except when it does. Which is not now._`,
        });
      }
      return;
    }

    await respond({
      response_type: "ephemeral",
      text: "Usage: `/south-heist start` | `/south-heist join` | `/south-heist go`",
    });
  });

  // /south-beg - Beg for money
  app.command("/south-beg", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;

    const result = await convex.mutation(api.beg.beg, { userId });

    if (result.error === "no_account") {
      await respond({
        response_type: "ephemeral",
        text: "No account. `/south-open-account` first. Even beggars need paperwork.",
      });
      return;
    }
    if (result.error === "cooldown") {
      await respond({
        response_type: "ephemeral",
        text: `You already begged recently. Try again in *${result.remaining} seconds*. Have some dignity.`,
      });
      return;
    }
    if (result.error) {
      await respond({
        response_type: "ephemeral",
        text: `Error: ${result.error}`,
      });
      return;
    }

    let message;
    switch (result.outcomeType) {
      case "denied":
        message = `You held out your hand. The teller looked at you, laughed, and walked away.\n\n*Received:* nothing. Absolutely nothing.`;
        break;
      case "tiny":
        message = `A teller flicked a coin at you. It bounced off your forehead.\n\n*Received:* ${formatMoney(result.amount)}\n*New balance:* ${formatMoney(result.newBalance)}`;
        break;
      case "decent":
        message = `Someone took pity on you and tossed some cash your way.\n\n*Received:* ${formatMoney(result.amount)}\n*New balance:* ${formatMoney(result.newBalance)}`;
        break;
      case "reverse":
        message = `YOU got charged for begging in the lobby. Security was called.\n\n*Lost:* ${formatMoney(Math.abs(result.amount))}\n*New balance:* ${formatMoney(result.newBalance)}`;
        break;
      case "jackpot":
        message = `The teller felt genuinely sorry for you. That's never happened before.\n\n*Received:* ${formatMoney(result.amount)}\n*New balance:* ${formatMoney(result.newBalance)}`;
        break;
      default:
        message = `Something happened. You got ${formatMoney(result.amount)}.\n*New balance:* ${formatMoney(result.newBalance)}`;
    }

    if (result.outcomeType !== "denied") {
      await notifyBalanceChange(
        client,
        convex,
        api,
        userId,
        "Begging",
        result.amount,
        result.newBalance,
      );
    }

    await respond({
      response_type: "ephemeral",
      text: message,
    });
  });

  // /south-notifs - Toggle balance notifications
  app.command("/south-notifs", async ({ command, ack, respond }) => {
    await ack();
    const userId = command.user_id;

    const result = await convex.mutation(api.accounts.toggleNotifications, {
      userId,
    });

    if (result === null) {
      await respond({
        response_type: "ephemeral",
        text: "You don't have an account. `/south-open-account` first.",
      });
      return;
    }

    await respond({
      response_type: "ephemeral",
      text: result
        ? "Balance notifications *enabled*. You'll get a DM every time your balance changes. Enjoy the anxiety."
        : "Balance notifications *disabled*. Ignorance is bliss.",
    });
  });

  // /south-mystery-fee - Charge yourself a mystery fee (why would you)
  app.command(
    "/south-mystery-fee",
    async ({ command, ack, respond, client }) => {
      await ack();
      const userId = command.user_id;
      const fee = Math.round((Math.random() * 0.49 + 0.01) * 100) / 100;
      const desc = randomFee();

      const result = await convex.mutation(api.accounts.chargeFee, {
        userId,
        amount: fee,
        description: desc,
      });

      if (result === null) {
        await respond({
          response_type: "ephemeral",
          text: "No account to charge. Lucky you.",
        });
        return;
      }

      await notifyBalanceChange(
        client,
        convex,
        api,
        userId,
        desc,
        -fee,
        result,
      );

      await respond({
        response_type: "ephemeral",
        text: `You've been charged *${formatMoney(fee)}* for: _${desc}_\n\nNew balance: ${formatMoney(result)}\n\nYou literally asked for this.`,
      });
    },
  );

  // /south-leaderboard - See the richest or poorest users
  app.command("/south-leaderboard", async ({ command, ack, respond }) => {
    await ack();
    const sub = command.text.trim().toLowerCase() || "top";

    if (sub === "bottom") {
      const results = await convex.query(api.leaderboard.bottom);
      if (results.length === 0) {
        await respond({
          response_type: "ephemeral",
          text: "No accounts exist yet. Somehow.",
        });
        return;
      }
      const lines = results
        .map(
          (r) =>
            `${r.rank}. <@${r.userId}> — ${formatMoney(r.balance)} (${r.status})`,
        )
        .join("\n");
      await respond({
        response_type: "in_channel",
        text: `*THE WALL OF SHAME*\n\n${lines}\n\n_These people owe more than they own. Inspirational._`,
      });
    } else {
      const results = await convex.query(api.leaderboard.top);
      if (results.length === 0) {
        await respond({
          response_type: "ephemeral",
          text: "No accounts exist yet.",
        });
        return;
      }
      const lines = results
        .map(
          (r) =>
            `${r.rank}. <@${r.userId}> — ${formatMoney(r.balance)} (${r.status})`,
        )
        .join("\n");
      await respond({
        response_type: "in_channel",
        text: `*SOUTHBAG RICH LIST*\n\n${lines}\n\n_Wealth is temporary. Southbag fees are forever._`,
      });
    }
  });

  // /south-invest - Invest money for potential returns
  app.command("/south-invest", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;
    const sub = command.text.trim().split(/\s+/)[0].toLowerCase();

    if (sub === "collect") {
      const result = await convex.mutation(api.invest.collect, { userId });
      if (result.error === "no_investment") {
        await respond({
          response_type: "ephemeral",
          text: "You have no active investment to collect.",
        });
        return;
      }
      if (result.error === "not_mature") {
        await respond({
          response_type: "ephemeral",
          text: `Your investment hasn't matured yet. ${result.remaining} minutes remaining.`,
        });
        return;
      }
      if (result.error === "no_account") {
        await respond({
          response_type: "ephemeral",
          text: "No account. `/south-open-account` first.",
        });
        return;
      }
      if (result.error) {
        await respond({
          response_type: "ephemeral",
          text: `Error: ${result.error}`,
        });
        return;
      }

      await notifyBalanceChange(
        client,
        convex,
        api,
        userId,
        `Investment ${result.status}`,
        result.payout,
        result.newBalance,
      );

      let message;
      if (result.multiplier === 0) {
        message = `*TOTAL LOSS*\n\nYour investment of ${formatMoney(result.invested)} is gone. All of it. The market ate it.\n\nNew balance: ${formatMoney(result.newBalance)}`;
      } else if (result.profit < 0) {
        message = `*PARTIAL LOSS*\n\nInvested: ${formatMoney(result.invested)}\nReturned: ${formatMoney(result.payout)} (${result.multiplier}x)\nLoss: ${formatMoney(Math.abs(result.profit))}\n\nNew balance: ${formatMoney(result.newBalance)}\n\n_The market giveth, and the market taketh._`;
      } else {
        message = `*INVESTMENT MATURED*\n\nInvested: ${formatMoney(result.invested)}\nReturned: ${formatMoney(result.payout)} (${result.multiplier}x)\nProfit: +${formatMoney(result.profit)}\n\nNew balance: ${formatMoney(result.newBalance)}\n\n_Don't get used to it._`;
      }

      await respond({ response_type: "ephemeral", text: message });
      return;
    }

    if (sub === "status") {
      const result = await convex.query(api.invest.status, { userId });
      if (!result) {
        await respond({
          response_type: "ephemeral",
          text: "No active investment. Use `/south-invest <amount>` to start one.",
        });
        return;
      }
      await respond({
        response_type: "ephemeral",
        text: `*Active Investment*\n\nAmount: ${formatMoney(result.amount)}\nMatures in: ${result.remaining} minutes\n\n_The market is doing... things._`,
      });
      return;
    }

    const amount = parseFloat(sub);
    if (isNaN(amount) || amount <= 0) {
      await respond({
        response_type: "ephemeral",
        text: "Usage: `/south-invest <amount>` | `/south-invest collect` | `/south-invest status`",
      });
      return;
    }

    const result = await convex.mutation(api.invest.invest, { userId, amount });
    if (result.error === "no_account") {
      await respond({
        response_type: "ephemeral",
        text: "No account. `/south-open-account` first.",
      });
      return;
    }
    if (result.error === "frozen") {
      await respond({
        response_type: "ephemeral",
        text: "Account frozen. No investing for you.",
      });
      return;
    }
    if (result.error === "insufficient") {
      await respond({
        response_type: "ephemeral",
        text: `You only have ${formatMoney(result.balance)}. Invest less.`,
      });
      return;
    }
    if (result.error === "already_invested") {
      await respond({
        response_type: "ephemeral",
        text: "You already have an active investment. `/south-invest collect` or `/south-invest status` first.",
      });
      return;
    }
    if (result.error) {
      await respond({
        response_type: "ephemeral",
        text: `Error: ${result.error}`,
      });
      return;
    }

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      "Investment deposit",
      -amount,
      result.newBalance,
    );

    await respond({
      response_type: "ephemeral",
      text: `*Investment placed*\n\nDeposited: ${formatMoney(amount)}\nManagement fee: ${formatMoney(result.fee)} (5%)\nActual invested: ${formatMoney(result.invested)}\nNew balance: ${formatMoney(result.newBalance)}\n\nCollect in 1 hour with \`/south-invest collect\`.\n\n_Past performance does not predict future results. Neither does anything else at Southbag._`,
    });
  });

  // /south-audit - Pay to reveal someone's financial details
  app.command("/south-audit", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;
    const text = command.text.trim();
    const targetMatch = text.match(/<@(\w+)(\|[^>]*)?>/);

    if (!targetMatch) {
      await respond({
        response_type: "ephemeral",
        text: "Usage: `/south-audit @user` — Costs $0.25 to peek at someone's finances.",
      });
      return;
    }

    const targetId = targetMatch[1];
    const result = await convex.mutation(api.audit.audit, { userId, targetId });

    if (result.error === "self_audit") {
      await respond({
        response_type: "ephemeral",
        text: "You already know your own finances. Use `/south-balance`.",
      });
      return;
    }
    if (result.error === "no_account") {
      await respond({
        response_type: "ephemeral",
        text: "No account. `/south-open-account` first.",
      });
      return;
    }
    if (result.error === "insufficient") {
      await respond({
        response_type: "ephemeral",
        text: `You need $0.25 for the audit fee. You only have ${formatMoney(result.balance)}.`,
      });
      return;
    }
    if (result.error === "no_target") {
      await respond({
        response_type: "ephemeral",
        text: "That user doesn't have a Southbag account.",
      });
      return;
    }
    if (result.error) {
      await respond({
        response_type: "ephemeral",
        text: `Error: ${result.error}`,
      });
      return;
    }

    await notifyBalanceChange(
      client,
      convex,
      api,
      userId,
      "Audit fee",
      -result.fee,
      result.auditorNewBalance,
    );

    const t = result.target;
    const txLines = t.recentTransactions
      .map(
        (tx) =>
          `  ${tx.type}: ${tx.amount >= 0 ? "+" : ""}${formatMoney(Math.abs(tx.amount))} — ${tx.description}`,
      )
      .join("\n");

    await respond({
      response_type: "in_channel",
      text: `*FINANCIAL AUDIT: <@${t.userId}>*\n\nBalance: ${formatMoney(t.balance)}\nStatus: ${t.status}\nTier: ${t.tier}\nAccount: \`${t.accountNumber}\`\n\n*Recent transactions:*\n${txLines}\n\n_Audit fee: ${formatMoney(result.fee)} charged to <@${userId}>. Privacy is a myth._`,
    });
  });

  // /south-shop - Open the shop modal
  app.command("/south-shop", async ({ command, ack, respond, client }) => {
    await ack();
    const userId = command.user_id;

    const account = await convex.query(api.accounts.getBalance, { userId });
    if (!account) {
      await respond({
        response_type: "ephemeral",
        text: "You don't have an account. Use `/south-open-account` first. Can't shop without money. Well, you can't shop WITH money either, but still.",
      });
      return;
    }

    const items = [
      {
        id: "blahaj",
        name: "Blahaj",
        price: 49.99,
        desc: "An IKEA shark. Southbag Support hates this. Buy it anyway.",
      },
      {
        id: "fee_insurance",
        name: "Fee Insurance",
        price: 99.99,
        desc: "Covers your next fee. Probably. No guarantees.",
      },
      {
        id: "kevins_briefcase",
        name: "Kevin's Briefcase",
        price: 250.0,
        desc: "Contents unknown. Kevin is watching.",
      },
      {
        id: "office_light_bulb",
        name: "Office Light Bulb",
        price: 5.0,
        desc: "For the flickering light. You know the one.",
      },
      {
        id: "incident_report",
        name: "2019 Incident Report",
        price: 500.0,
        desc: "Redacted. All of it. Worth every cent.",
      },
      {
        id: "southbag_mug",
        name: "Southbag Mug",
        price: 12.5,
        desc: "Says 'I survived Southbag Support' on the side. The handle is broken.",
      },
      {
        id: "kevins_parking_spot",
        name: "Kevin's Parking Spot",
        price: 1000.0,
        desc: "He doesn't know you have this. Yet.",
      },
      {
        id: "kevins_stapler",
        name: "Kevin's Stapler",
        price: 15.0,
        desc: "Red. Do not touch. Kevin knows.",
      },
      {
        id: "break_room_key",
        name: "Break Room Key",
        price: 75.0,
        desc: "The break room has been locked since 2019. Nobody knows why.",
      },
      {
        id: "employee_handbook",
        name: "Employee Handbook",
        price: 3.0,
        desc: '400 pages. All of them say "don\'t".',
      },
      {
        id: "office_plant",
        name: "Office Plant",
        price: 25.0,
        desc: "It's fake. Everything here is fake.",
      },
      {
        id: "motivational_poster",
        name: "Motivational Poster",
        price: 8.0,
        desc: '"Hang in there" but the cat fell off years ago.',
      },
      {
        id: "kevins_voicemail",
        name: "Kevin's Voicemail",
        price: 150.0,
        desc: '47 seconds of breathing and then "I know."',
      },
      {
        id: "fire_extinguisher",
        name: "Fire Extinguisher",
        price: 40.0,
        desc: "Expired in 2017. Still on the wall. Decorative.",
      },
      {
        id: "parking_cone",
        name: "Parking Cone",
        price: 2.0,
        desc: "From the parking lot. Kevin's been looking for it.",
      },
      {
        id: "server_rack_dust",
        name: "Server Rack Dust",
        price: 0.5,
        desc: "A small bag of dust from the server room. Vintage 2019.",
      },
      {
        id: "complaint_form",
        name: "Complaint Form",
        price: 10.0,
        desc: 'Pre-filled with "denied". Saves time.',
      },
      {
        id: "kevins_tie",
        name: "Kevin's Tie",
        price: 200.0,
        desc: "He wore this to the 2019 holiday party. It has a stain.",
      },
      {
        id: "ceiling_tile",
        name: "Ceiling Tile",
        price: 1.0,
        desc: "From above your desk. There's something written on the back. You can't read it.",
      },
      {
        id: "security_badge",
        name: "Expired Security Badge",
        price: 35.0,
        desc: "Opens nothing. But it beeps when you tap it. Reassuring.",
      },
      {
        id: "fluorescent_tube",
        name: "Fluorescent Tube",
        price: 7.5,
        desc: "Buzzes at a frequency that causes mild existential dread.",
      },
      {
        id: "kevins_chair",
        name: "Kevin's Office Chair",
        price: 2000.0,
        desc: "Ergonomic. Heated. Sentient. It knows things.",
      },
      {
        id: "kevins_password",
        name: "Kevin's Password",
        price: 5000.0,
        desc: "Written on a sticky note. You shouldn't have this.",
      },
      {
        id: "water_cooler",
        name: "Water Cooler",
        price: 30.0,
        desc: "The one where rumours are born. Empty. Has been empty.",
      },
      {
        id: "exit_sign",
        name: "Exit Sign",
        price: 18.0,
        desc: "It points the wrong way. Always has.",
      },
      {
        id: "kevins_family_photo",
        name: "Kevin's Family Photo",
        price: 350.0,
        desc: "The frame is empty. Kevin says it's not.",
      },
      {
        id: "broken_clock",
        name: "Broken Clock",
        price: 6.0,
        desc: "Stopped at 2:19 AM. The same time as the incident.",
      },
      {
        id: "sticky_notes",
        name: "Sticky Notes (Used)",
        price: 0.25,
        desc: 'Someone wrote "HELP" on all of them. In Kevin\'s handwriting.',
      },
      {
        id: "office_key_card",
        name: "Office Key Card (Floor 3)",
        price: 500.0,
        desc: "There is no Floor 3. The elevator disagrees.",
      },
      {
        id: "paper_shredder",
        name: "Paper Shredder",
        price: 45.0,
        desc: "Only shreds important documents. Refuses junk mail.",
      },
      {
        id: "kevins_coffee_mug",
        name: "Kevin's Coffee Mug",
        price: 85.0,
        desc: "Always full. Always cold. Nobody refills it.",
      },
      {
        id: "whiteboard_marker",
        name: "Whiteboard Marker (Red)",
        price: 4.0,
        desc: "Writes in a colour that doesn't exist on the spectrum.",
      },
      {
        id: "desk_drawer_contents",
        name: "Desk Drawer Contents",
        price: 20.0,
        desc: "A sealed bag. Rattles. Do not open before 2027.",
      },
      {
        id: "visitor_badge",
        name: "Visitor Badge (Permanent)",
        price: 60.0,
        desc: 'Says "VISITOR" but the expiry date is "never". You live here now.',
      },
      {
        id: "network_cable",
        name: "Network Cable",
        price: 11.0,
        desc: "Connected to something. Nobody knows what. Unplugging it causes screaming.",
      },
      {
        id: "kevins_nameplate",
        name: "Kevin's Nameplate",
        price: 750.0,
        desc: "Solid brass. The name changes depending on who's reading it.",
      },
      {
        id: "emergency_manual",
        name: "Emergency Manual",
        price: 100.0,
        desc: "Step 1: Don't panic. Step 2: Panic. Step 3: See Kevin. There is no Step 4.",
      },
    ];

    const blocks = [
      {
        type: "header",
        text: { type: "plain_text", text: "Southbag Gift Shop" },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_Your balance: ${formatMoney(account.balance)} — All sales are final. All items are questionable._`,
          },
        ],
      },
      { type: "divider" },
    ];

    for (const item of items) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${item.name}* — ${formatMoney(item.price)}\n_${item.desc}_`,
        },
        accessory: {
          type: "overflow",
          action_id: `shop_action_${item.id}`,
          options: [
            {
              text: { type: "plain_text", text: "Buy" },
              value: `buy_${item.id}`,
            },
            {
              text: { type: "plain_text", text: "Buy Multiple" },
              value: `buymulti_${item.id}`,
            },
            {
              text: { type: "plain_text", text: "Gift to someone" },
              value: `gift_${item.id}`,
            },
            {
              text: { type: "plain_text", text: "Gift to Kevin" },
              value: `giftkevin_${item.id}`,
            },
          ],
        },
      });
    }

    blocks.push({ type: "divider" });
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_Kevin does not endorse any of these products. Especially the shark._",
        },
      ],
    });

    try {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: {
          type: "modal",
          callback_id: "shop_browse",
          notify_on_close: true,
          private_metadata: JSON.stringify({ userId }),
          title: { type: "plain_text", text: "Southbag Gift Shop" },
          close: { type: "plain_text", text: "Leave (coward)" },
          blocks,
        },
      });
    } catch (e) {
      await respond({
        response_type: "ephemeral",
        blocks,
      });
    }
  });

  // /south-inventory - View your inventory
  app.command("/south-inventory", async ({ command, ack, respond }) => {
    await ack();
    const userId = command.user_id;

    const inventory = await convex.query(api.shop.getInventory, { userId });
    if (inventory === null) {
      await respond({
        response_type: "ephemeral",
        text: "No account. `/south-open-account` first. You can't own things without an account.",
      });
      return;
    }

    if (inventory.length === 0) {
      await respond({
        response_type: "ephemeral",
        text: "*Your Inventory*\n\nEmpty. Like your wallet. Like your soul.\n\nVisit `/south-shop` to buy things you don't need.",
      });
      return;
    }

    const flavourText = {
      blahaj:
        "It stares at you with its beady little eyes. You feel... comforted. Kevin does not approve.",
      fee_insurance:
        "A laminated card that says 'NO FEES' in Comic Sans. The fine print says 'lol jk maybe'.",
      kevins_briefcase:
        "It hums faintly. You haven't opened it. You won't. You can't.",
      office_light_bulb:
        "60 watts of pure rebellion. The flickering has stopped. For now.",
      incident_report:
        "Every page is blacked out. Except one word on page 47: 'Kevin.'",
      southbag_mug:
        "The handle broke off immediately. Classic Southbag quality. Still holds liquid though. Barely.",
      kevins_parking_spot:
        "A laminated parking pass. Kevin has been circling the lot for weeks. He suspects nothing.",
      kevins_stapler:
        "It's warm to the touch. It shouldn't be warm. Kevin's initials are carved into the bottom.",
      break_room_key:
        "The key fits the lock but the door won't open. Something is blocking it from the inside.",
      employee_handbook:
        "Page 1: 'Don't.' Page 2: 'Seriously.' Pages 3-400: Blank.",
      office_plant:
        "You've been watering it for weeks before realising. The pot is empty. There is no soil.",
      motivational_poster:
        "The frame is bolted to the wall. You cannot remove it. You've tried.",
      kevins_voicemail: "You played it once. You will not play it again.",
      fire_extinguisher:
        "The label says 'For emergency use only.' Below that, someone wrote 'there is no emergency. there was never an emergency.'",
      parking_cone:
        "Kevin walked past your desk three times today. He's getting closer.",
      server_rack_dust:
        "It glows faintly in the dark. IT says that's normal. IT hasn't been seen in weeks.",
      complaint_form:
        "You filled it out anyway. The ink disappeared. The form is blank again.",
      kevins_tie:
        "It smells like regret and expensive cologne. The stain moves when you're not looking.",
      ceiling_tile:
        "You held it up to a mirror. The writing says your name. That's impossible. You bought this today.",
      security_badge:
        "The photo on it isn't you. It's Kevin. All the badges are Kevin.",
      fluorescent_tube:
        "It whispers. You tell yourself it's just the electrical hum. It isn't.",
      kevins_chair:
        "It rolled towards you when no one was in the room. It's in your cubicle now. It won't leave.",
      kevins_password:
        "It's '1234'. It's always been '1234'. You expected more. Kevin did not.",
      water_cooler:
        "It gurgles at exactly 3 PM every day. There is no water inside. There is no mechanism.",
      exit_sign:
        "You followed it once. You ended up in Kevin's office. He was waiting.",
      kevins_family_photo:
        "You stared at the empty frame for too long. Something stared back.",
      broken_clock:
        "You wound it. The hands moved backwards. Your phone clock changed too.",
      sticky_notes:
        "You peeled one off. Underneath was another that said 'TOO LATE'.",
      office_key_card:
        "You swiped it at the elevator. Floor 3 appeared. You did not press it. The doors closed.",
      paper_shredder:
        "You fed it a blank page. It spat out a page with your employee review. You don't work here.",
      kevins_coffee_mug:
        "You tried to pour it out. It refilled. You tried again. It refilled faster.",
      whiteboard_marker:
        "You drew a circle. When you looked back, it was a door. It's gone now.",
      desk_drawer_contents: "It stopped rattling. That's worse.",
      visitor_badge:
        "You tried to take it off. It's attached. It's always been attached.",
      network_cable:
        "You traced it through the wall. It goes into the floor. Then up. Into your desk. Out your monitor. Into the cable.",
      kevins_nameplate:
        "It says your name now. It's been on your desk all morning. You didn't put it there.",
      emergency_manual:
        "You opened to Step 3. Kevin's phone number is your phone number.",
    };

    const itemCounts = {};
    for (const item of inventory) {
      if (!itemCounts[item.itemId]) {
        itemCounts[item.itemId] = { name: item.name, count: 0, giftedBy: null };
      }
      itemCounts[item.itemId].count++;
      if (item.giftedBy) itemCounts[item.itemId].giftedBy = item.giftedBy;
    }

    const lines = Object.entries(itemCounts).map(([itemId, info]) => {
      const flavour =
        flavourText[itemId] ||
        "A mysterious item. Even we don't know what it does.";
      const countText = info.count > 1 ? ` (x${info.count})` : "";
      const giftText = info.giftedBy
        ? ` _(gifted by <@${info.giftedBy}>)_`
        : "";
      return `*${info.name}*${countText}${giftText}\n_${flavour}_`;
    });

    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "Your Inventory" },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: lines.join("\n\n") },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `_${inventory.length} item${inventory.length === 1 ? "" : "s"} total. None of them useful._`,
            },
          ],
        },
      ],
    });
  });
  // /south-combine - AI-powered infinite craft system (like Infinite Craft)
  app.command("/south-combine", async ({ command, ack, client }) => {
    await ack();
    const userId = command.user_id;

    // Get inventory
    const inventory = await convex.query(api.shop.getInventory, { userId });
    if (!inventory || inventory.length === 0) {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: "Your inventory is empty. Can't combine nothing with nothing.",
      });
      return;
    }

    // Build item options for dropdowns (limit to 100 for Slack static_select)
    const itemOptions = combinedItems.slice(0, 100).map((item) => ({
      text: { type: "plain_text", text: item.name },
      value: item.itemId,
    }));

    const modal = {
      type: "modal",
      callback_id: "combine_modal",
      title: { type: "plain_text", text: "Combine Items" },
      submit: { type: "plain_text", text: "Combine" },
      close: { type: "plain_text", text: "Cancel" },
      private_metadata: JSON.stringify({ userId }),
      blocks: [
        {
          type: "input",
          block_id: "item_a_block",
          label: { type: "plain_text", text: "First Item" },
          element: {
            type: "static_select",
            action_id: "item_a_select",
            placeholder: { type: "plain_text", text: "Choose first item" },
            options: itemOptions,
          },
        },
        {
          type: "input",
          block_id: "item_b_block",
          label: { type: "plain_text", text: "Second Item" },
          element: {
            type: "static_select",
            action_id: "item_b_select",
            placeholder: { type: "plain_text", text: "Choose second item" },
            options: itemOptions,
          },
        },
      ],
    };

    try {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: modal,
      });
    } catch (e) {
      console.error("Error opening combine modal:", e);
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: "Error opening modal. Please try again.",
      });
    }
  });

  // Handle combine_modal submission
  app.view("combine_modal", async ({ view, ack, client, body }) => {
    const { userId } = JSON.parse(view.private_metadata);
    const itemIdA =
      view.state.values.item_a_block.item_a_select.selected_option?.value;
    const itemIdB =
      view.state.values.item_b_block.item_b_select.selected_option?.value;

    // Validate inputs
    const errors = {};
    if (!itemIdA) {
      errors.item_a_block = "Please select first item";
    }
    if (!itemIdB) {
      errors.item_b_block = "Please select second item";
    }

    if (Object.keys(errors).length > 0) {
      await ack({
        response_action: "errors",
        errors,
      });
      return;
    }

    await ack();

    // Get inventory to find item names
    const inventory = await convex.query(api.shop.getInventory, { userId });
    const itemA = inventory.find((i) => i.itemId === itemIdA);
    const itemB = inventory.find((i) => i.itemId === itemIdB);

    if (!itemA || !itemB) {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: "One of the items is no longer in your inventory.",
      });
      return;
    }

    // Generate combination via AI
    const aiPrompt = `You are a creative AI in an "Infinite Craft" style game set in the Southbag Online Banking universe. Two office items have been combined.

Generate a creative, humorous new item that results from combining these two things. Keep the Southbag dark humor tone.

Item 1: ${itemA.name}
Item 2: ${itemB.name}

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "name": "Name of the new combined item",
  "description": "A brief 1-2 sentence description with dark Southbag humor"
}`;

    const aiMessages = [
      {
        role: "system",
        content:
          "You are a creative AI for an Infinite Craft-like game. Respond ONLY with valid JSON, no other text.",
      },
      { role: "user", content: aiPrompt },
    ];

    let aiResponse;
    let resultName, resultDescription;

    try {
      aiResponse = await chat(aiMessages, env);

      // Extract JSON from response (handle cases where model adds extra text)
      let parsed;
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }

      // Validate and sanitize fields
      resultName = (parsed.name || "").trim().slice(0, 100);
      resultDescription = (parsed.description || "").trim().slice(0, 500);

      if (!resultName) {
        resultName = "Unknown Combination";
      }
      if (!resultDescription) {
        resultDescription = "A mysterious fusion of two items.";
      }
    } catch (err) {
      console.error("Error generating combination:", err);
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: "The items rejected each other. Better luck next time. [FEE:0.10:Failed combination attempt]",
      });

      // Still charge the failure fee
      await convex.mutation(api.accounts.chargeFee, {
        userId,
        amount: 0.1,
        description: "Failed combination attempt fee",
      });
      return;
    }

    // Call backend to combine items with AI-generated result
    const result = await convex.mutation(api.combine.combineAI, {
      userId,
      itemIdA,
      itemIdB,
      resultName,
      resultDescription,
    });

    if (result.error === "no_account") {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: "No account.",
      });
      return;
    }
    if (result.error === "missing_item") {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: "One of the items is no longer in your inventory.",
      });
      return;
    }
    if (result.error) {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: `Error: ${result.error}`,
      });
      return;
    }

    const say = async (opts) => {
      if (typeof opts === "string")
        opts = { text: opts, channel: ALLOWED_CHANNEL };
      await client.chat.postMessage({ channel: ALLOWED_CHANNEL, ...opts });
    };

    await say({
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "✨ ITEMS COMBINED" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<@${userId}> combined *${itemA.name}* + *${itemB.name}*\n\n*${result.resultName}*\n_${result.resultDescription}_`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `_Crafting fee: ${formatMoney(result.fee)} · New balance: ${formatMoney(result.newBalance)}_`,
            },
          ],
        },
      ],
    });
  });

  // /south-use - Use a combined item on someone (Block Kit modal)
  app.command("/south-use", async ({ command, ack, client }) => {
    await ack();
    const userId = command.user_id;

    // Get combined items from inventory
    const inventory = await convex.query(api.shop.getInventory, { userId });
    if (!inventory || inventory.length === 0) {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: "Your inventory is empty. Craft something with `/south-combine` first.",
      });
      return;
    }

    const combinedItems = inventory.filter((i) =>
      i.itemId.startsWith("combo:"),
    );
    if (combinedItems.length === 0) {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: "You don't have any combined items. Craft one with `/south-combine` first.",
      });
      return;
    }

    // Build options for item dropdown (limit to 100 for Slack static_select)
    const itemOptions = combinedItems.slice(0, 100).map((item) => ({
      text: { type: "plain_text", text: item.name },
      value: item.itemId,
    }));

    const modal = {
      type: "modal",
      callback_id: "use_item_modal",
      title: { type: "plain_text", text: "Use Combined Item" },
      submit: { type: "plain_text", text: "Use Item" },
      close: { type: "plain_text", text: "Cancel" },
      private_metadata: JSON.stringify({ userId }),
      blocks: [
        {
          type: "input",
          block_id: "item_block",
          label: { type: "plain_text", text: "Select an item to use" },
          element: {
            type: "static_select",
            action_id: "item_select",
            placeholder: { type: "plain_text", text: "Choose an item" },
            options: itemOptions,
          },
        },
        {
          type: "input",
          block_id: "target_block",
          label: { type: "plain_text", text: "Target" },
          element: {
            type: "static_select",
            action_id: "target_type",
            placeholder: { type: "plain_text", text: "Choose a target" },
            options: [
              {
                text: { type: "plain_text", text: "A User" },
                value: "user",
              },
              {
                text: { type: "plain_text", text: "Kevin" },
                value: "kevin",
              },
              {
                text: { type: "plain_text", text: "Southbag Support" },
                value: "support",
              },
            ],
          },
        },
        {
          type: "input",
          block_id: "user_target_block",
          label: { type: "plain_text", text: "User Target" },
          optional: true,
          element: {
            type: "users_select",
            action_id: "target_user",
            placeholder: { type: "plain_text", text: "Select a user" },
          },
        },
      ],
    };

    try {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: modal,
      });
    } catch (e) {
      console.error("Error opening use item modal:", e);
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: "Error opening modal. Please try again.",
      });
    }
  });

  // Handle use_item_modal submission
  app.view("use_item_modal", async ({ view, ack, client, body }) => {
    const { userId } = JSON.parse(view.private_metadata);
    const itemId =
      view.state.values.item_block.item_select.selected_option?.value;
    const targetType =
      view.state.values.target_block.target_type.selected_option?.value;
    const targetUserId =
      view.state.values.user_target_block.target_user.selected_user;

    // Validate inputs
    const errors = {};
    if (!itemId) {
      errors.item_block = "Please select an item";
    }
    if (!targetType) {
      errors.target_block = "Please select a target";
    }
    if (targetType === "user" && !targetUserId) {
      errors.user_target_block = "Please select a user target";
    }

    if (Object.keys(errors).length > 0) {
      await ack({
        response_action: "errors",
        errors,
      });
      return;
    }

    await ack();

    // Call the backend mutation
    const result = await convex.mutation(api.combine.useItem, {
      userId,
      itemId,
      targetType,
      targetUserId,
    });

    if (result.error === "no_account") {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: "No account.",
      });
      return;
    }
    if (result.error === "not_combined") {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: result.message,
      });
      return;
    }
    if (result.error === "missing_item") {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: "You don't have that item anymore.",
      });
      return;
    }
    if (result.error) {
      await client.chat.postEphemeral({
        channel: userId,
        user: userId,
        text: `Error: ${result.error}`,
      });
      return;
    }

    // Get channel from body (use view's original channel if available)
    const channelId = body.trigger_id ? userId : body.channel_id;

    const targetLabel =
      targetType === "kevin"
        ? "Kevin"
        : targetType === "support"
          ? "Southbag Support"
          : `<@${targetUserId}>`;

    // Generate AI response for the item usage
    const { parseCommands, executeCommands } = require("./commands");

    const targetDescription =
      targetType === "kevin"
        ? "Kevin (the CEO)"
        : targetType === "support"
          ? "Southbag Support"
          : `a user (${targetLabel})`;

    const aiPrompt = `A user just used a combined item on ${targetDescription}. Respond in character as the target, reacting to being hit/affected by this item. Keep it short (1-3 sentences max), sarcastic, and in keeping with Southbag's dark humor.

Item: ${result.resultName}
What it is: ${result.description}
Made from: ${result.ingredients.join(" + ")}
Used on: ${targetDescription}

Respond as the target experiencing this item's effect. Be dramatic and humorous. You can include fee charges using [FEE:amount:reason] format if appropriate.`;

    const aiMessages = [
      {
        role: "system",
        content:
          "You are a character in the Southbag Online Banking system. Respond briefly and darkly humorously.",
      },
      { role: "user", content: aiPrompt },
    ];

    let responseText;
    try {
      responseText = await chat(aiMessages, env);
    } catch (err) {
      console.error("Error generating AI response:", err);
      responseText = `${targetLabel} stares blankly at the ${result.resultName}. Nothing happens. Everything is broken now. [FEE:1.00:AI system failure surcharge]`;
    }

    const { cleanText, commands } = parseCommands(responseText);

    // Post in allowed channel if it's a Slack workspace, otherwise in DM
    const say = async (opts) => {
      if (typeof opts === "string")
        opts = { text: opts, channel: ALLOWED_CHANNEL };
      await client.chat.postMessage({ channel: ALLOWED_CHANNEL, ...opts });
    };

    await say({
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${result.resultName} USED ON ${targetLabel.toUpperCase().replace(/<@[A-Z0-9]+>/g, "A VICTIM")}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<@${userId}> used *${result.resultName}* on ${targetLabel}:\n\n${cleanText}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `_Item consumed · Usage fee: ${formatMoney(result.fee)} · The item is gone forever. Worth it? Probably not._`,
            },
          ],
        },
      ],
    });

    // Execute any embedded commands (fees, disconnects, glitches, etc.)
    if (commands.length > 0) {
      const fakeEvent = {
        channel: ALLOWED_CHANNEL,
        user: userId,
        ts: Date.now().toString(),
        thread_ts: undefined,
      };
      await executeCommands(commands, say, client, fakeEvent, {
        convex,
        api,
        notifyBalanceChange,
      });
    }
  });
}

async function notifyBalanceChange(
  client,
  convex,
  api,
  userId,
  description,
  amount,
  newBalance,
) {
  try {
    const notifyUsers = await convex.query(api.accounts.getNotificationUsers, {
      userIds: [userId],
    });
    if (notifyUsers.length === 0) return;

    const sign = amount >= 0 ? "+" : "";
    await client.chat.postMessage({
      channel: userId,
      text: `*Balance Update*\n${description}: ${sign}${formatMoney(Math.abs(amount))}\nNew balance: ${formatMoney(newBalance)}`,
    });
  } catch (e) {}
}

module.exports = { registerBankingCommands, notifyBalanceChange };
