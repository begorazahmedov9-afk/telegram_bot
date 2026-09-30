const { Bot, Keyboard, InlineKeyboard, session } = require("grammy");
const Database = require("better-sqlite3");

// 1. BAZA VA BOTNI SOZLASH
const db = new Database("bot_database.db");
const bot = new Bot("8996799485:AAHVP67ckKjd9UHTcSnOM3cyV2AkMgt_VGw");

// Sessiyani sozlash
bot.use(session({ initial: () => ({ step: "idle", orderType: "", calcPrice: 79000, calcFeatures: [] }) }));
bot.catch((err) => console.error("Botda xatolik:", err));

// Baza jadvallari
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    first_name TEXT,
    username TEXT,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    rating INTEGER,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// ADMIN ID VA KANAL
const ADMIN_ID = 123456789; // <-- O'zingizning Telegram ID'ingizni yozing
const REQUIRED_CHANNEL = "@begorazkino"; // Majburiy obuna kanali

// 2. MENYULAR
const mainMenu = new Keyboard()
  .text("🤖 Bot yaratish").text("🧮 Narxni hisoblash").row()
  .text("❓ Ko'p beriladigan savollar").text("⭐️ Fikr qoldirish").row()
  .text("🌐 Ijtimoiy tarmoqlar").text("ℹ️ Biz haqimizda").row()
  .resized();

const botTypesMenu = new Keyboard()
  .text("🛒 Internet do'kon bot").text("🍽 Restoran / Kafe bot").row()
  .text("📅 Qabul / Bron qilish bot").text("🎓 Ta'lim / Kurslar bot").row()
  .text("📣 Kanal / Admin bot").text("⚡ Unikal maxsus bot").row()
  .text("⬅️️ Ortga").row()
  .resized();

// 3. MAJBURIIY OBUNA MIDDLEWARE
async function checkSubscription(ctx, next) {
  if (ctx.from.id === ADMIN_ID) return next();
  try {
    const member = await ctx.api.getChatMember(REQUIRED_CHANNEL, ctx.from.id);
    if (["creator", "administrator", "member"].includes(member.status)) {
      return next();
    }
  } catch (e) {
    return next();
  }

  const checkBtn = new InlineKeyboard()
    .url("📢 Kanalga a'zo bo'lish", `https://t.me/${REQUIRED_CHANNEL.replace("@", "")}`)
    .row()
    .text("✅ Obunani tekshirish", "check_sub");

  return ctx.reply(
    `⚠ <b>Botdan foydalanish uchun rasmiy kanalimizga a'zo bo'ling!</b>\n\n` +
    `A'zo bo'lgach, "✅ Obunani tekshirish" tugmasini bosing.`,
    { parse_mode: "HTML", reply_markup: checkBtn }
  );
}

bot.use(checkSubscription);

// 4. /start BUYRUG'I
bot.command("start", async (ctx) => {
  const { id, first_name, username } = ctx.from;
  db.prepare(`
    INSERT OR REPLACE INTO users (user_id, first_name, username)
    VALUES (?, ?, ?)
  `).run(id, first_name, username || "");

  await ctx.reply(
    `<b>Assalomu alaykum, ${first_name}!</b> 👋\n\n` +
    `<b>DevCraft Studio</b> rasmiy interaktiv botiga xush kelibsiz!\n` +
    `Biz sizning biznesingiz uchun eng zamonaviy Telegram botlarni yaratib beramiz.\n\n` +
    `👇 Kerakli bo'limni tanlang:`,
    { parse_mode: "HTML", reply_markup: mainMenu }
  );
});

bot.callbackQuery("check_sub", async (ctx) => {
  await ctx.answerCallbackQuery("Tekshirilmoqda...");
  await ctx.reply("Rahmat! Botdan to'liq foydalanishingiz mumkin 👇", { reply_markup: mainMenu });
});

// 5. 🧮 NARX KALKULYATORI FUNKSIYASI
bot.hears("🧮 Narxni hisoblash", async (ctx) => {
  ctx.session.calcPrice = 79000;
  ctx.session.calcFeatures = [];

  const calcKeyboard = new InlineKeyboard()
    .text("➕ Admin Panel (+30,000)", "calc_admin").row()
    .text("➕ To'lov tizimi (Click/Payme) (+50,000)", "calc_payment").row()
    .text("➕ Ko'p tillilik (Uz/Ru/En) (+40,000)", "calc_multilang").row()
    .text("✅ Yakunlash va Buyurtma berish", "calc_finish");

  await ctx.reply(
    `<b>🧮 Bot kalkulyatori</b>\n\n` +
    `Boshlang'ich narx: <b>79,000 so'm</b>\n` +
    `Kerakli qo'shimcha imkoniyatlarni tanlang:`,
    { parse_mode: "HTML", reply_markup: calcKeyboard }
  );
});

bot.callbackQuery(/^calc_/, async (ctx) => {
  const action = ctx.match.input;

  if (action === "calc_admin" && !ctx.session.calcFeatures.includes("Admin Panel")) {
    ctx.session.calcPrice += 30000;
    ctx.session.calcFeatures.push("Admin Panel");
    await ctx.answerCallbackQuery("Admin Panel qo'shildi!");
  } else if (action === "calc_payment" && !ctx.session.calcFeatures.includes("To'lov Tizimi")) {
    ctx.session.calcPrice += 50000;
    ctx.session.calcFeatures.push("To'lov Tizimi");
    await ctx.answerCallbackQuery("To'lov tizimi qo'shildi!");
  } else if (action === "calc_multilang" && !ctx.session.calcFeatures.includes("Ko'p tillilik")) {
    ctx.session.calcPrice += 40000;
    ctx.session.calcFeatures.push("Ko'p tillilik");
    await ctx.answerCallbackQuery("Ko'p tillilik qo'shildi!");
  } else if (action === "calc_finish") {
    ctx.session.orderType = `Kalkulyator orqali (${ctx.session.calcFeatures.join(", ") || "Oddiy bot"})`;
    ctx.session.step = "waiting_for_phone";
    await ctx.answerCallbackQuery();

    const phoneKeyboard = new Keyboard().requestContact("📱 Telefon raqamni yuborish").oneTime().resized();
    return ctx.reply(
      `<b>Jami hisoblangan narx: ${ctx.session.calcPrice.toLocaleString()} so'm</b>\n\n` +
      `Buyurtma berish uchun telefon raqamingizni yuboring:`,
      { parse_mode: "HTML", reply_markup: phoneKeyboard }
    );
  }

  const updatedKeyboard = new InlineKeyboard()
    .text(`${ctx.session.calcFeatures.includes("Admin Panel") ? "✅" : "➕"} Admin Panel (+30,000)`, "calc_admin").row()
    .text(`${ctx.session.calcFeatures.includes("To'lov Tizimi") ? "✅" : "➕"} To'lov tizimi (+50,000)`, "calc_payment").row()
    .text(`${ctx.session.calcFeatures.includes("Ko'p tillilik") ? "✅" : "➕"} Ko'p tillilik (+40,000)`, "calc_multilang").row()
    .text("✅ Yakunlash va Buyurtma berish", "calc_finish");

  await ctx.editMessageText(
    `<b>🧮 Bot kalkulyatori</b>\n\n` +
    `Tanlanganlar: ${ctx.session.calcFeatures.join(", ") || "Yo'q"}\n` +
    `Jami narx: <b>${ctx.session.calcPrice.toLocaleString()} so'm</b>`,
    { parse_mode: "HTML", reply_markup: updatedKeyboard }
  );
});

// 6. ❓ FAQS (SAVOL-JAVOBLAR)
bot.hears("❓ Ko'p beriladigan savollar", async (ctx) => {
  const faqKeyboard = new InlineKeyboard()
    .text("⏱ Bot qancha vaqtda tayyor bo'ladi?", "faq_time").row()
    .text("💳 To'lov qanday amalga oshiriladi?", "faq_payment").row()
    .text("🛠 Kafolat va qo'llab-quvvatlash bormi?", "faq_guarantee");

  await ctx.reply("<b>❓ Sizni qiziqtirgan savolni tanlang:</b>", { parse_mode: "HTML", reply_markup: faqKeyboard });
});

bot.callbackQuery("faq_time", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("⚡ Oddiy botlar <b>1 kunda</b>, murakkab va funksional botlar <b>1-3 kunda</b> to'liq topshiriladi.", { parse_mode: "HTML" });
});

bot.callbackQuery("faq_payment", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("💳 To'lovlar Click, Payme yoki bank kartasi orqali 50% oldindan, 50% bot topshirilgach amalga oshiriladi.", { parse_mode: "HTML" });
});

bot.callbackQuery("faq_guarantee", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("🛡 Biz yaratgan barcha botlarga <b>1 oylik bepul kafolat</b> va texnik ko'mak beriladi!", { parse_mode: "HTML" });
});

// 7. ⭐️ FIKR QOLDIRISH
bot.hears("⭐️ Fikr qoldirish", async (ctx) => {
  const ratingMenu = new InlineKeyboard()
    .text("⭐️", "rate_1").text("⭐️⭐️", "rate_2").text("⭐️⭐️⭐️", "rate_3").row()
    .text("⭐️⭐️⭐️⭐️", "rate_4").text("⭐️⭐️⭐️⭐️⭐️", "rate_5");

  await ctx.reply("Xizmatimizni nechta yulduzcha bilan baholaysiz?", { reply_markup: ratingMenu });
});

bot.callbackQuery(/^rate_/, async (ctx) => {
  const rating = ctx.match.input.split("_")[1];
  db.prepare("INSERT INTO reviews (user_id, rating) VALUES (?, ?)").run(ctx.from.id, rating);
  await ctx.answerCallbackQuery("Rahmat!");
  await ctx.reply(`⭐️ <b>${rating} yulduzcha</b> uchun rahmat! DevCraft Studio rivojlanishiga hissa qo'shdingiz.`, { parse_mode: "HTML" });
});

// 8. BOT YARATISH BO'LIMI
bot.hears("🤖 Bot yaratish", async (ctx) => {
  await ctx.reply("👇 <b>O'zingizga kerakli bot turini tanlang:</b>", { parse_mode: "HTML", reply_markup: botTypesMenu });
});

const handleBotSelection = async (ctx, botTitle) => {
  ctx.session.orderType = botTitle;
  const inlineBtn = new InlineKeyboard()
    .text("📝 Buyurtma berish", `order_${botTitle}`)
    .row()
    .url("👨‍💻 Admin bilan bog'lanish", "https://t.me/ahmedv012");

  await ctx.reply(
    `<b>${botTitle}</b>\n\n` +
    `💵 <b>Boshlang'ich narxi:</b> 79 000 so'm 🔥\n` +
    `⚡ <b>Topshirish vaqti:</b> 1 - 3 kun\n\n` +
    `Buyurtma berish uchun quyidagi tugmani bosing:`,
    { parse_mode: "HTML", reply_markup: inlineBtn }
  );
};

bot.hears("🛒 Internet do'kon bot", (ctx) => handleBotSelection(ctx, "Internet do'kon bot"));
bot.hears("🍽 Restoran / Kafe bot", (ctx) => handleBotSelection(ctx, "Restoran / Kafe bot"));
bot.hears("📅 Qabul / Bron qilish bot", (ctx) => handleBotSelection(ctx, "Qabul / Bron qilish bot"));
bot.hears("🎓 Ta'lim / Kurslar bot", (ctx) => handleBotSelection(ctx, "Ta'lim / Kurslar bot"));
bot.hears("📣 Kanal / Admin bot", (ctx) => handleBotSelection(ctx, "Kanal / Admin bot"));
bot.hears("⚡ Unikal maxsus bot", (ctx) => handleBotSelection(ctx, "Unikal maxsus bot"));

bot.callbackQuery(/^order_/, async (ctx) => {
  ctx.session.step = "waiting_for_phone";
  await ctx.answerCallbackQuery();

  const phoneKeyboard = new Keyboard().requestContact("📱 Telefon raqamni yuborish").oneTime().resized();

  await ctx.reply("Iltimos, siz bilan bog'lanishimiz uchun <b>📱 Telefon raqamni yuborish</b> tugmasini bosing:", {
    parse_mode: "HTML",
    reply_markup: phoneKeyboard,
  });
});

// 9. ADMIN PANEL & BROADCAST
bot.command("admin", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  const totalReviews = db.prepare("SELECT COUNT(*) as count FROM reviews").get().count;

  const adminMenu = new InlineKeyboard()
    .text("📊 Statistika", "admin_stats")
    .text("📢 Reklama yuborish", "admin_broadcast");

  await ctx.reply(
    `<b>👨‍💻 Admin Paneli</b>\n\n` +
    `👥 Jami foydalanuvchilar: <b>${totalUsers} ta</b>\n` +
    `⭐️ Qoldirilgan baholar: <b>${totalReviews} ta</b>`,
    { parse_mode: "HTML", reply_markup: adminMenu }
  );
});

bot.callbackQuery("admin_stats", async (ctx) => {
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  await ctx.answerCallbackQuery();
  await ctx.reply(`📈 <b>Bot Statistikasi:</b>\n\nBaza a'zolari: <b>${totalUsers} ta</b>`, { parse_mode: "HTML" });
});

bot.callbackQuery("admin_broadcast", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  ctx.session.step = "waiting_for_broadcast";
  await ctx.answerCallbackQuery();
  await ctx.reply("📢 <b>Barcha foydalanuvchilarga yubormoqchi bo'lgan xabaringizni yozing:</b>", { parse_mode: "HTML" });
});

// 10. MA'LUMOTLARNI QABUL QILISH (MESSAGE HANDLER)
bot.on("message", async (ctx) => {
  if (ctx.session.step === "waiting_for_broadcast" && ctx.from.id === ADMIN_ID) {
    ctx.session.step = "idle";
    const users = db.prepare("SELECT user_id FROM users").all();
    let count = 0;

    for (const user of users) {
      try {
        await ctx.copyMessage(user.user_id);
        count++;
      } catch (e) {}
    }
    return ctx.reply(`✅ Xabar <b>${count} ta</b> foydalanuvchiga yuborildi!`, { parse_mode: "HTML" });
  }

  if (ctx.session.step === "waiting_for_phone") {
    const phone = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;
    ctx.session.step = "idle";

    await ctx.api.sendMessage(
      ADMIN_ID,
      `<b>🔥 YANGI BUYURTMA!</b>\n\n` +
      `👤 <b>Mijoz:</b> ${ctx.from.first_name} (@${ctx.from.username || "yo'q"})\n` +
      `📦 <b>Loyiha:</b> ${ctx.session.orderType}\n` +
      `📞 <b>Tel:</b> <code>${phone}</code>`,
      { parse_mode: "HTML" }
    );

    await ctx.reply("✅ <b>Buyurtmangiz qabul qilindi!</b> Tez orada siz bilan bog'lanamiz.", {
      parse_mode: "HTML",
      reply_markup: mainMenu,
    });
  }
});

// BOSHQA MATNLAR
bot.hears("🌐 Ijtimoiy tarmoqlar", async (ctx) => {
  const socialInline = new InlineKeyboard()
    .url("💬 Telegram Kanal", "https://t.me/begorazkino")
    .url("📸 Instagram", "https://instagram.com/akhmedw.1")
    .row()
    .url("💻 GitHub", "https://github.com/begorazahmedov9-afk");

  await ctx.reply("<b>🌐 Bizning ijtimoiy tarmoqlarimiz:</b>", { parse_mode: "HTML", reply_markup: socialInline });
});

bot.hears("ℹ️ Biz haqimizda", async (ctx) => {
  await ctx.reply(
    `<b>ℹ️ DevCraft Studio</b>\n\n` +
    `Sifatli va qulay Telegram botlar va web-saytlar yaratish xizmati.\n\n` +
    `👨‍💻 <b>Dasturchi:</b> Begoraz Ahmedov\n` +
    `📞 <b>Aloqa:</b> +998 99 230 57 87\n` +
    `💬 <b>Telegram:</b> @ahmedv012`,
    { parse_mode: "HTML" }
  );
});

bot.hears("⬅️️ Ortga", async (ctx) => {
  await ctx.reply("Asosiy menyuga qaytdingiz 👇", { reply_markup: mainMenu });
});

bot.start({ drop_pending_updates: true });
console.log("🚀 Yangi funksiyalar bilan bot muvaffaqiyatli ishga tushdi!");