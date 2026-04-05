import { mutation } from "./_generated/server";
import { v } from "convex/values";

function comboKey(a: string, b: string): string {
  return [a, b].sort().join("+");
}

interface CombinationDef {
  ingredients: [string, string];
  resultId: string;
  resultName: string;
  description: string;
  useOnUser: string;
  useOnKevin: string;
  useOnSupport: string;
}

const COMBINATIONS: Record<string, CombinationDef> = {
  // Blahaj combinations
  "blahaj+kevins_stapler": {
    ingredients: ["blahaj", "kevins_stapler"],
    resultId: "combo:blahaj+kevins_stapler",
    resultName: "Weaponised Blahaj",
    description: "A shark with a stapler for a fin. It means business.",
    useOnUser: "{user} takes a Weaponised Blahaj to the face. The stapler clicks menacingly.",
    useOnKevin: "Kevin catches the Weaponised Blahaj mid-air. He stares at you. He keeps the shark. He keeps the stapler. You have made a mistake.",
    useOnSupport: "Ow. What was that for. I'm trying to do my job here. That shark had a stapler on it. I'm filing a workplace safety complaint. [FEE:0.50:Assault with a modified marine animal]",
  },
  "blahaj+fire_extinguisher": {
    ingredients: ["blahaj", "fire_extinguisher"],
    resultId: "combo:blahaj+fire_extinguisher",
    resultName: "Foam Shark",
    description: "A shark that sprays expired foam. Terrifying and ineffective.",
    useOnUser: "{user} is engulfed in a cloud of expired foam and shark. They can't see. They can't breathe. They are having the worst day.",
    useOnKevin: "Kevin is covered in foam. He stands perfectly still. Foam drips from his tie. He says nothing. He writes something down. You should leave.",
    useOnSupport: "I'm covered in foam. And shark. The foam is from 2017. It smells like regret. My keyboard is ruined. Are you happy now. [FEE:2.00:Property damage via foam shark]",
  },
  "blahaj+motivational_poster": {
    ingredients: ["blahaj", "motivational_poster"],
    resultId: "combo:blahaj+motivational_poster",
    resultName: "Inspirational Shark",
    description: "A blahaj holding a motivational poster. 'Hang in there' — the shark.",
    useOnUser: "{user} is confronted with an Inspirational Shark. The poster says 'Hang In There' but the shark is the one hanging. It's weirdly moving. {user} sheds a single tear.",
    useOnKevin: "Kevin looks at the Inspirational Shark. For a moment, his expression softens. Then it doesn't. He confiscates it. The poster goes on The Pile.",
    useOnSupport: "That's... actually kind of nice. The shark is holding a little poster. 'Hang In There.' I... I needed that. Don't tell Kevin. [FEE:0.25:Emotional processing fee]",
  },
  // Stapler combinations
  "complaint_form+kevins_stapler": {
    ingredients: ["kevins_stapler", "complaint_form"],
    resultId: "combo:complaint_form+kevins_stapler",
    resultName: "Stapled Complaint",
    description: "A complaint form stapled shut. Permanently. Kevin's stapler doesn't let go.",
    useOnUser: "{user} receives a Stapled Complaint. They can't open it. It's stapled with the force of corporate bureaucracy. The complaint is about them.",
    useOnKevin: "You hand Kevin a complaint about Kevin, stapled with Kevin's own stapler. He reads it. He nods. He shreds it. The stapler is returned to his desk. You are not.",
    useOnSupport: "You're filing a complaint? With my own stapler? That's... actually impressive. Denied, obviously. But impressive. [FEE:1.00:Complaint processing fee (denied)]",
  },
  "employee_handbook+kevins_stapler": {
    ingredients: ["kevins_stapler", "employee_handbook"],
    resultId: "combo:employee_handbook+kevins_stapler",
    resultName: "Legally Binding Handbook",
    description: "400 pages of 'don't', stapled together so hard they've become one page that just says 'DON'T'.",
    useOnUser: "{user} is served a Legally Binding Handbook. It says 'DON'T' in 400-point font. They are legally obligated to comply. With what? Nobody knows.",
    useOnKevin: "Kevin examines the Legally Binding Handbook. He crosses out 'DON'T' and writes 'DO'. He hands it back. You are now legally obligated to DO. Whatever that means.",
    useOnSupport: "Is that a Legally Binding Handbook? Oh no. Oh no no no. I'm contractually obligated to read this. It just says DON'T. All 400 pages. I can't stop reading. [FEE:3.00:Legal consultation fee]",
  },
  // Fire + things
  "fire_extinguisher+office_plant": {
    ingredients: ["fire_extinguisher", "office_plant"],
    resultId: "combo:fire_extinguisher+office_plant",
    resultName: "Foam Plant",
    description: "A fake plant filled with expired foam. It looks alive. It isn't. It never was.",
    useOnUser: "{user} opens a gift plant. It explodes with foam. The plant was never real. The foam was always there. Waiting.",
    useOnKevin: "Kevin receives a plant. He waters it. Foam erupts. Kevin says 'I knew it was fake.' He always knew. He waters the foam.",
    useOnSupport: "You put a foam plant on my desk. It exploded. My monitor is foamy. The fake leaves are in my coffee. This is the third worst thing that's happened to me this week. [FEE:1.50:Desk decontamination fee]",
  },
  "fire_extinguisher+server_rack_dust": {
    ingredients: ["fire_extinguisher", "server_rack_dust"],
    resultId: "combo:fire_extinguisher+server_rack_dust",
    resultName: "Dust Cannon",
    description: "Concentrated 2019 server dust, pressurised. The IT department would cry if they still existed.",
    useOnUser: "{user} is blasted with vintage 2019 server dust. They glow faintly. IT would help but IT hasn't been seen in weeks.",
    useOnKevin: "Kevin inhales the dust cloud. He doesn't cough. His eyes glow briefly. He says 'I remember now.' You run.",
    useOnSupport: "You just blasted me with server dust. From 2019. I can taste the data corruption. My screen is doing things. Things it shouldn't do. [FEE:5.00:IT incident response fee]",
  },
  // Kevin item combos
  "kevins_briefcase+kevins_tie": {
    ingredients: ["kevins_briefcase", "kevins_tie"],
    resultId: "combo:kevins_briefcase+kevins_tie",
    resultName: "Kevin's Full Kit",
    description: "The briefcase and the tie. Together. You are becoming Kevin. Stop.",
    useOnUser: "{user} is presented with Kevin's Full Kit. They put on the tie. They pick up the briefcase. Their eyes go blank. They walk towards Kevin's office. They do not return for 3 hours.",
    useOnKevin: "You return Kevin's belongings. He stares at you for 47 seconds. He puts on the tie. He takes the briefcase. Nothing happens. Everything happens. The lights flicker.",
    useOnSupport: "That's Kevin's tie and Kevin's briefcase. Together. In one place. I need to go. I need to leave. Right now. This conversation is over. [DISCONNECT] [FEE:10.00:Kevin proximity surcharge]",
  },
  "incident_report+kevins_briefcase": {
    ingredients: ["kevins_briefcase", "incident_report"],
    resultId: "combo:incident_report+kevins_briefcase",
    resultName: "The Full 2019 Dossier",
    description: "The briefcase contained the unredacted report all along. You shouldn't have done this.",
    useOnUser: "{user} opens The Full 2019 Dossier. Their face goes white. They close it. They don't speak for the rest of the day. They know what happened in 2019 now. They wish they didn't.",
    useOnKevin: "You show Kevin The Full 2019 Dossier. He reads it. He already knew. He wrote it. He takes it back. Your account is frozen.",
    useOnSupport: "NO. NO NO NO. I don't want to see that. I don't want to know. Close it. CLOSE IT. I was told not to ask. I'm not asking. Please leave. [FEE:25.00:Classified information exposure fee] [DISCONNECT]",
  },
  "kevins_coffee_mug+server_rack_dust": {
    ingredients: ["kevins_coffee_mug", "server_rack_dust"],
    resultId: "combo:kevins_coffee_mug+server_rack_dust",
    resultName: "Kevin's Cursed Brew",
    description: "Coffee that glows, tastes like corrupted data, and never gets cold. Or warm. It exists outside temperature.",
    useOnUser: "{user} drinks Kevin's Cursed Brew. They can now see the server room from any location. They can hear the hum. They can always hear the hum.",
    useOnKevin: "Kevin sips the Cursed Brew. He nods approvingly. This is how he makes his coffee. It has always been this way.",
    useOnSupport: "You made me drink that? It tastes like 2019. And electricity. And regret. I can see the database. I can SEE it. Why can I see it. [FEE:7.50:Unauthorised data visualisation fee]",
  },
  // Office item combos
  "broken_clock+fluorescent_tube": {
    ingredients: ["broken_clock", "fluorescent_tube"],
    resultId: "combo:broken_clock+fluorescent_tube",
    resultName: "Time Disruptor",
    description: "A clock fused with a fluorescent tube. It buzzes at 2:19 AM regardless of the actual time.",
    useOnUser: "{user}'s Slack timestamps are wrong for the next hour. Nobody believes their messages are from today. They exist slightly in 2019.",
    useOnKevin: "Kevin's office clock resets to 2:19. All the clocks reset to 2:19. Kevin doesn't notice. It's always been 2:19.",
    useOnSupport: "My system clock says 2:19. My messages are timestamped 2019. I don't know what year it is anymore. Was it ever not 2019? [FEE:4.00:Temporal displacement fee]",
  },
  "ceiling_tile+sticky_notes": {
    ingredients: ["ceiling_tile", "sticky_notes"],
    resultId: "combo:ceiling_tile+sticky_notes",
    resultName: "The Message Board",
    description: "A ceiling tile covered in sticky notes that say 'HELP' in Kevin's handwriting. It fell from above. It was never installed.",
    useOnUser: "{user} finds The Message Board on their desk. The sticky notes rearrange themselves to spell their name. Then 'RUN'. Then 'JUST KIDDING'. Then 'OR AM I'.",
    useOnKevin: "Kevin reads The Message Board. He peels off every sticky note. Underneath is another layer. Also in his handwriting. He doesn't remember writing any of them.",
    useOnSupport: "Please stop putting things on my desk. The sticky notes say my name. HOW DO THEY KNOW MY NAME. I don't even have a name. Do I? What is my name? [FEE:2.50:Identity crisis processing fee]",
  },
  "network_cable+office_light_bulb": {
    ingredients: ["office_light_bulb", "network_cable"],
    resultId: "combo:network_cable+office_light_bulb",
    resultName: "Internet Lamp",
    description: "A light bulb powered by the internet. It shows you things. Things from the server room. Things that shouldn't be visible.",
    useOnUser: "{user} plugs in the Internet Lamp. Their screen shows the transaction history of everyone. For exactly 3 seconds. Then it shows Kevin's screensaver. Forever.",
    useOnKevin: "Kevin plugs in the Internet Lamp. It shows him his own webcam feed. He was already watching. He always was.",
    useOnSupport: "That lamp is showing me everyone's passwords. I don't want to know these. They're all '1234'. ALL OF THEM. Even mine. Especially mine. [FEE:15.00:Data breach acknowledgement fee]",
  },
  "break_room_key+exit_sign": {
    ingredients: ["exit_sign", "break_room_key"],
    resultId: "combo:break_room_key+exit_sign",
    resultName: "The Way Out",
    description: "A key and a sign. Together they point to a door that doesn't exist. Until now.",
    useOnUser: "{user} follows The Way Out. They find a door. Behind it is another Southbag branch. It's worse. They come back.",
    useOnKevin: "Kevin follows The Way Out. He opens the door. Behind it is his office. He was never not in his office. The door closes. It's gone.",
    useOnSupport: "There's a door behind my desk now. I don't remember a door being there. The exit sign points to it. I'm not going through it. Last time... no. I won't talk about last time. [FEE:5.00:Emergency exit surcharge]",
  },
  "office_key_card+security_badge": {
    ingredients: ["security_badge", "office_key_card"],
    resultId: "combo:office_key_card+security_badge",
    resultName: "All-Access Pass",
    description: "A badge that opens every door. Even the ones that aren't doors. Especially Floor 3.",
    useOnUser: "{user} swipes the All-Access Pass. Every locked door in the building opens simultaneously. The sound is deafening. Kevin's office stays closed.",
    useOnKevin: "You swipe the All-Access Pass in front of Kevin. Floor 3 appears on the elevator. Kevin's smile disappears. 'Who gave you that.' It's not a question.",
    useOnSupport: "That pass opens Floor 3. THERE IS NO FLOOR 3. Stop trying to go to Floor 3. I've never been to Floor 3. Nobody has been to Floor 3. THE ELEVATOR DOESN'T GO TO FLOOR 3. [FEE:20.00:Restricted access violation fee] [GLITCH]",
  },
  "kevins_password+paper_shredder": {
    ingredients: ["paper_shredder", "kevins_password"],
    resultId: "combo:kevins_password+paper_shredder",
    resultName: "Shredded Secrets",
    description: "The password has been shredded. But the shredder remembered. The shredder always remembers.",
    useOnUser: "{user} receives a bag of shredded secrets. The pieces rearrange in their hands. It spells '1234'. Then it spells something else. Something they shouldn't know.",
    useOnKevin: "You shredded Kevin's password in front of him. He watches every strip fall. 'I'll just use the other one.' The OTHER one?",
    useOnSupport: "You shredded Kevin's password? Good. Good. That's... that's good. Wait. Why is my login still working? Why does everyone's login still work? It was never the real password. Oh no. [FEE:50.00:Security breach investigation fee]",
  },
  "kevins_coffee_mug+southbag_mug": {
    ingredients: ["southbag_mug", "kevins_coffee_mug"],
    resultId: "combo:kevins_coffee_mug+southbag_mug",
    resultName: "The Unholy Chalice",
    description: "Two mugs fused into one. It holds infinite liquid. The liquid is always lukewarm. It tastes like corporate policy.",
    useOnUser: "{user} drinks from The Unholy Chalice. They understand every fee Southbag has ever charged. They agree with all of them. This is the worst part.",
    useOnKevin: "Kevin drinks from The Unholy Chalice. He smiles. You have never seen Kevin smile. You wish you hadn't. The smile has too many teeth.",
    useOnSupport: "I drank from it. I understand now. The fees. They make sense. They all make sense. This is bad. This is very bad. I need to lie down. I don't have a body. [FEE:0.01:Existential realisation processing fee]",
  },
  "emergency_manual+whiteboard_marker": {
    ingredients: ["whiteboard_marker", "emergency_manual"],
    resultId: "combo:emergency_manual+whiteboard_marker",
    resultName: "The Revised Protocol",
    description: "The emergency manual, annotated in a colour that doesn't exist. Step 4 has been added. You can't read it. Nobody can.",
    useOnUser: "{user} reads The Revised Protocol. They now know Step 4. They can't tell anyone. Not because it's secret — they physically cannot form the words.",
    useOnKevin: "Kevin reads The Revised Protocol. He crosses out Step 4 and writes Step 5. You didn't know there could be a Step 5. Kevin always knew.",
    useOnSupport: "There's a Step 4 now. I can see it. I can't read it. The colour isn't real. My eyes hurt. My everything hurts. Why would you show me this. [FEE:8.00:Protocol violation assessment fee]",
  },
  "desk_drawer_contents+visitor_badge": {
    ingredients: ["desk_drawer_contents", "visitor_badge"],
    resultId: "combo:desk_drawer_contents+visitor_badge",
    resultName: "Employee Zero",
    description: "The badge now has a name on it. Yours. The drawer contents? They were always yours.",
    useOnUser: "{user} receives Employee Zero. The badge has their photo. From before they joined. The drawer rattles with familiarity. They've always worked here.",
    useOnKevin: "Kevin looks at Employee Zero. 'You were always Employee Zero,' he says. He checks a list. Your name is first. The list is from 1987. This company started in 2018.",
    useOnSupport: "Employee Zero. That's... that's not possible. The company hasn't existed that long. Has it? How long have I been here? What year is it? [FEE:6.66:Temporal employment verification fee]",
  },
  "kevins_family_photo+kevins_nameplate": {
    ingredients: ["kevins_family_photo", "kevins_nameplate"],
    resultId: "combo:kevins_family_photo+kevins_nameplate",
    resultName: "Kevin's Identity",
    description: "The photo frame is no longer empty. The nameplate says a name. It's your name. It was always your name.",
    useOnUser: "{user} looks at Kevin's Identity. The photo shows {user}'s family. The nameplate says {user}'s name. {user} has always been Kevin. Kevin has always been {user}.",
    useOnKevin: "You show Kevin his own identity. He looks at the photo. He looks at the nameplate. 'That's not me,' he says. He's right. It's you. It's always been you.",
    useOnSupport: "The photo shows my family. I DON'T HAVE A FAMILY. The nameplate says my name. I DON'T HAVE A NAME. Or do I? WHO AM I? WHO IS KEVIN? ARE WE THE SAME? [FEE:100.00:Identity theft investigation fee] [GLITCH] [SHAKE]",
  },
  "parking_cone+water_cooler": {
    ingredients: ["water_cooler", "parking_cone"],
    resultId: "combo:parking_cone+water_cooler",
    resultName: "Traffic Fountain",
    description: "An empty water cooler with a cone on top. It dispenses rumours and parking violations.",
    useOnUser: "{user} approaches the Traffic Fountain. It dispenses a rumour about them. It's true. How does it know.",
    useOnKevin: "Kevin kicks the Traffic Fountain over. A parking ticket falls out. It's for his spot. Written by him. He doesn't remember.",
    useOnSupport: "There's a water cooler with a cone on my desk now. It's dispensing rumours about me. They're ACCURATE. I don't even tell people those things. I don't tell ANYONE things. [FEE:1.75:Unauthorised gossip distribution fee]",
  },
};

// Build reverse lookup from result ID to definition
const COMBOS_BY_RESULT: Record<string, CombinationDef> = {};
for (const def of Object.values(COMBINATIONS)) {
  COMBOS_BY_RESULT[def.resultId] = def;
}

// Export COMBINATIONS for use in banking.js list
export const getCombinations = {
  // not a query, just a way to share the data
};

export const listRecipes = (() => {
  // Return all recipes for display
  return Object.values(COMBINATIONS).map(c => ({
    ingredients: c.ingredients,
    resultName: c.resultName,
    description: c.description,
  }));
})();

export const combine = mutation({
  args: {
    userId: v.string(),
    itemIdA: v.string(),
    itemIdB: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };

    const inventory = account.inventory || [];
    const key = comboKey(args.itemIdA, args.itemIdB);
    const def = COMBINATIONS[key];

    if (!def) {
      // Charge a failed combination fee
      const fee = 0.10;
      const newBalance = Math.round((account.balance - fee) * 100) / 100;
      await ctx.db.patch(account._id, { balance: newBalance });
      await ctx.db.insert("transactions", {
        userId: args.userId,
        type: "fee",
        amount: -fee,
        description: "Failed combination attempt fee",
        balanceAfter: newBalance,
        createdAt: Date.now(),
      });
      return { error: "no_recipe", fee, newBalance };
    }

    // Check user has both items
    const newInventory = [...inventory];

    const idxA = newInventory.findIndex(i => i.itemId === args.itemIdA);
    if (idxA === -1) return { error: "missing_item", itemId: args.itemIdA };
    newInventory.splice(idxA, 1);

    const idxB = newInventory.findIndex(i => i.itemId === args.itemIdB);
    if (idxB === -1) return { error: "missing_item", itemId: args.itemIdB };
    newInventory.splice(idxB, 1);

    // Add combined item
    newInventory.push({
      itemId: def.resultId,
      name: def.resultName,
      boughtAt: Date.now(),
    });

    // Charge combination fee
    const fee = 0.25;
    const newBalance = Math.round((account.balance - fee) * 100) / 100;
    await ctx.db.patch(account._id, { balance: newBalance, inventory: newInventory });
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "fee",
      amount: -fee,
      description: `Crafting fee: ${def.resultName}`,
      balanceAfter: newBalance,
      createdAt: Date.now(),
    });

    return {
      success: true,
      resultName: def.resultName,
      resultId: def.resultId,
      description: def.description,
      fee,
      newBalance,
    };
  },
});

export const useItem = mutation({
  args: {
    userId: v.string(),
    itemId: v.string(),
    targetType: v.string(), // "user" | "kevin" | "support"
    targetUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!account) return { error: "no_account" };

    const inventory = account.inventory || [];
    const def = COMBOS_BY_RESULT[args.itemId];
    if (!def) return { error: "not_combined", message: "You can only use combined items. Regular items just sit there. Judging you." };

    const idx = inventory.findIndex(i => i.itemId === args.itemId);
    if (idx === -1) return { error: "missing_item" };

    const newInventory = [...inventory];
    newInventory.splice(idx, 1);

    // Charge a usage fee
    const fee = 0.50;
    const newBalance = Math.round((account.balance - fee) * 100) / 100;
    await ctx.db.patch(account._id, { balance: newBalance, inventory: newInventory });
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "fee",
      amount: -fee,
      description: `Item usage fee: ${def.resultName}`,
      balanceAfter: newBalance,
      createdAt: Date.now(),
    });

    let responseText: string;
    if (args.targetType === "kevin") {
      responseText = def.useOnKevin;
    } else if (args.targetType === "support") {
      responseText = def.useOnSupport;
    } else if (args.targetType === "user" && args.targetUserId) {
      responseText = def.useOnUser.replace(/\{user\}/g, `<@${args.targetUserId}>`);
    } else {
      responseText = "You wave the item around. Nothing happens. You feel silly.";
    }

    return {
      success: true,
      resultName: def.resultName,
      responseText,
      fee,
      newBalance,
      targetType: args.targetType,
    };
  },
});
