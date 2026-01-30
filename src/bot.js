require("dotenv").config({ path: ".env" });
// src/bot.js
const {
  Client,
  GatewayIntentBits,
  Partials,
} = require("discord.js");

const { readPending, removePending } = require("./pendingStore");
const { startDashboard } = require("./dashboard");
const gifConverter = require("./gifConverter");

// جلب التوكن من Render Environment
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("❌ خطأ: DISCORD_TOKEN غير موجود في إعدادات Render.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// بدء التنظيف الدوري لمجلد temp
gifConverter.startPeriodicCleanup(60);

// استخدام clientReady لتفادي التحذيرات
client.once("clientReady", async () => {
  console.log(`✅ تم تسجيل الدخول باسم: ${client.user.tag}`);

  // ربط البوت بالداشبورد (الداشبورد تعمل بالفعل في الخلفية)
  startDashboard(client);

  // معالجة الرسائل المعلقة (Pending)
  const pending = readPending();
  const now = Date.now();
  for (const [messageId, record] of Object.entries(pending)) {
     if (!record?.endsAtMs) {
        removePending(messageId);
        continue;
     }
     // ... (بقية منطق الجدولة الخاص بك)
  }
});

// تسجيل الدخول
client.login(token);

function isMemeMessage(message) {
  if (!message.attachments || message.attachments.size === 0) return false;
  for (const [, att] of message.attachments) {
    const ct = (att.contentType || "").toLowerCase();
    if (ct.startsWith("image/") || ct.startsWith("video/")) return true;
    const name = (att.name || "").toLowerCase();
    if (/\.(png|jpe?g|gif|webp|mp4|mov|webm)$/i.test(name)) return true;
  }
  return false;
}

async function safeReact(message, emoji) {
  try {
    await message.react(emoji);
  } catch (e) {
    // قد يفشل مع إيموجي غير صالح أو صلاحيات ناقصة
    console.warn(`Failed to react with ${emoji} on message ${message.id}:`, e?.message || e);
  }
}

// =============== دالة إرسال سجل الحذف ===============
async function sendDeleteLog(guild, config, msg, pos, neg, reason) {
  if (!config.logChannelId) {
    console.log("[Log] No log channel configured");
    return;
  }

  try {
    const logChannel = await guild.channels.fetch(config.logChannelId).catch(() => null);
    if (!logChannel) {
      console.log("[Log] Could not fetch log channel:", config.logChannelId);
      return;
    }

    // جلب الرسالة الكاملة إذا كانت partial
    let fullMsg = msg;
    if (msg.partial) {
      fullMsg = await msg.fetch().catch(() => msg);
    }

    const attachment = fullMsg.attachments?.first();
    const authorId = fullMsg.author?.id || "unknown";
    const authorTag = fullMsg.author?.tag || "Unknown User";
    const timestamp = new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });

    const embed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setAuthor({
        name: "تم حذف ميم",
        iconURL: fullMsg.author?.displayAvatarURL() || guild.iconURL()
      })
      .addFields(
        { name: "الناشر", value: authorId !== "unknown" ? `<@${authorId}>` : authorTag, inline: true },
        { name: "القناة", value: `<#${fullMsg.channelId}>`, inline: true },
        { name: "التصويت", value: `${config.emojis.positive} **${pos}** | ${config.emojis.negative} **${neg}**`, inline: true },
        { name: "السبب", value: reason, inline: false }
      )
      .setFooter({ text: `ID: ${fullMsg.id}` })
      .setTimestamp();

    if (attachment?.url) {
      embed.setThumbnail(attachment.url);
    }

    if (fullMsg.content) {
      embed.setDescription(`> ${fullMsg.content.slice(0, 200)}${fullMsg.content.length > 200 ? "..." : ""}`);
    }

    await logChannel.send({ embeds: [embed] });
    console.log(`[Log] Sent delete log for message ${fullMsg.id}`);
  } catch (err) {
    console.error("[Log] Error sending delete log:", err);
  }
}

async function finalizeVote(record) {
  const { guildId, channelId, messageId } = record;
  removePending(messageId);

  // إذا انحذفت القناة/السيرفر أو فقدنا الصلاحيات، نتجاهل
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const config = getGuildConfig(guildId);
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) return;

  const msg = await channel.messages.fetch(messageId).catch(() => null);
  if (!msg) return; // الرسالة قد تكون محذوفة بالفعل

  const posKey = parseEmojiKey(config.emojis.positive);
  const negKey = parseEmojiKey(config.emojis.negative);

  // نجلب المستخدمين لكل رياكشن لكي لا نحسب البوت نفسه
  const posReaction = msg.reactions.cache.get(posKey) || null;
  const negReaction = msg.reactions.cache.get(negKey) || null;

  const countUsers = async (reaction) => {
    if (!reaction) return 0;
    const users = await reaction.users.fetch().catch(() => null);
    if (!users) return 0;
    return users.filter((u) => !u.bot).size;
  };

  const pos = await countUsers(posReaction);
  const neg = await countUsers(negReaction);

  if (neg > pos) {
    // تسجيل الإحصائيات
    if (msg.author?.id) {
      incrementDeleteCount(guildId, msg.author.id);
    }
    await sendDeleteLog(guild, config, msg, pos, neg, "التصويت السلبي أعلى (الوضع المؤقت)");
    await msg.delete().catch(() => null);
  }
}

function scheduleFinalize(guildId, channelId, messageId, endsAtMs, createdAtMs) {
  const now = Date.now();
  const delay = Math.max(0, endsAtMs - now);

  if (scheduled.has(messageId)) return;

  const timeoutId = setTimeout(async () => {
    scheduled.delete(messageId);
    await finalizeVote({ guildId, channelId, messageId, endsAtMs, createdAtMs });
  }, delay);

  scheduled.set(messageId, timeoutId);
  upsertPending(messageId, { guildId, channelId, createdAtMs, endsAtMs });
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // تشغيل الداشبورد
  startDashboard(client);

  // إعادة جدولة المؤقّتات بعد إعادة تشغيل البوت
  const pending = readPending();
  const now = Date.now();
  for (const [messageId, record] of Object.entries(pending)) {
    if (!record?.endsAtMs || !record?.guildId || !record?.channelId) {
      removePending(messageId);
      continue;
    }
    if (record.endsAtMs <= now) {
      // انتهى وقته أثناء انطفاء البوت
      finalizeVote({ ...record, messageId }).catch(() => null);
      continue;
    }
    scheduleFinalize(record.guildId, record.channelId, messageId, record.endsAtMs, record.createdAtMs || now);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "memerate") return;
  if (!interaction.inGuild()) return;

  // السماح فقط لمدير السيرفر (Manage Guild) — كطبقة حماية إضافية
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: "تحتاج صلاحية Manage Server لإدارة إعدادات البوت.", ephemeral: true });
    return;
  }

  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();
  const config = getGuildConfig(guildId);

  if (sub === "status") {
    const intervalText = config.mode === "continuous" ? `\n- Check Interval: ${config.checkIntervalSeconds || 30} ثانية` : "";
    const logText = config.logChannelId ? `<#${config.logChannelId}>` : "غير محدد";
    await interaction.reply({
      ephemeral: true,
      content:
        `**Memerate config**\n` +
        `- Channels: ${config.enabledChannelIds.length ? config.enabledChannelIds.map((id) => `<#${id}>`).join(", ") : "none"}\n` +
        `- Duration: ${config.durationMinutes} minutes\n` +
        `- Emojis: ${config.emojis.positive} / ${config.emojis.negative}\n` +
        `- Mode: ${config.mode === "continuous" ? "مستمر (يفحص دورياً)" : "مؤقت (يفحص بعد المدة)"}` + intervalText + `\n` +
        `- Log Channel: ${logText}`,
    });
    return;
  }

  if (sub === "setduration") {
    const minutes = interaction.options.getInteger("minutes", true);
    const next = setGuildConfig(guildId, { durationMinutes: minutes });
    await interaction.reply({ ephemeral: true, content: `تم ضبط مدة التصويت إلى **${next.durationMinutes}** دقيقة.` });
    return;
  }

  if (sub === "setemojis") {
    const positive = interaction.options.getString("positive", true).trim();
    const negative = interaction.options.getString("negative", true).trim();
    const next = setGuildConfig(guildId, { emojis: { positive, negative } });
    await interaction.reply({ ephemeral: true, content: `تم ضبط الإيموجيات إلى: ${next.emojis.positive} / ${next.emojis.negative}` });
    return;
  }

  if (sub === "addchannel") {
    const channel = interaction.options.getChannel("channel", true);
    const ids = new Set(config.enabledChannelIds);
    ids.add(channel.id);
    const next = setGuildConfig(guildId, { enabledChannelIds: Array.from(ids) });
    await interaction.reply({ ephemeral: true, content: `تمت إضافة القناة ${channel} للمراقبة.` });
    return;
  }

  if (sub === "removechannel") {
    const channel = interaction.options.getChannel("channel", true);
    const nextIds = config.enabledChannelIds.filter((id) => id !== channel.id);
    setGuildConfig(guildId, { enabledChannelIds: nextIds });
    await interaction.reply({ ephemeral: true, content: `تمت إزالة القناة ${channel} من المراقبة.` });
    return;
  }

  if (sub === "setmode") {
    const mode = interaction.options.getString("mode", true);
    const next = setGuildConfig(guildId, { mode });
    const modeText = mode === "continuous" ? "مستمر (يفحص دورياً)" : "مؤقت (يفحص بعد انتهاء المدة)";

    // إعادة تشغيل الفحص المستمر إذا تم تفعيله
    if (mode === "continuous") {
      startContinuousCheck(guildId);
    } else {
      stopContinuousCheck(guildId);
    }

    await interaction.reply({ ephemeral: true, content: `تم ضبط وضع الفحص إلى: **${modeText}**` });
    return;
  }

  if (sub === "setinterval") {
    const seconds = interaction.options.getInteger("seconds", true);
    setGuildConfig(guildId, { checkIntervalSeconds: seconds });

    // إعادة تشغيل الفحص بالفترة الجديدة إذا كان الوضع مستمر
    if (config.mode === "continuous") {
      startContinuousCheck(guildId);
    }

    await interaction.reply({ ephemeral: true, content: `تم ضبط فترة الفحص إلى: **${seconds}** ثانية` });
    return;
  }

  if (sub === "setlogchannel") {
    const channel = interaction.options.getChannel("channel");
    if (channel) {
      setGuildConfig(guildId, { logChannelId: channel.id });
      await interaction.reply({ ephemeral: true, content: `تم ضبط قناة السجل إلى: ${channel}` });
    } else {
      setGuildConfig(guildId, { logChannelId: null });
      await interaction.reply({ ephemeral: true, content: `تم إيقاف سجل الميمز المحذوفة` });
    }
    return;
  }

  if (sub === "worstmemes") {
    const limit = interaction.options.getInteger("limit") || 10;
    const leaderboard = getLeaderboard(guildId, limit);

    if (leaderboard.length === 0) {
      await interaction.reply({ ephemeral: true, content: "لا توجد إحصائيات بعد." });
      return;
    }

    // حساب أعلى عدد للشريط التقدمي
    const maxCount = leaderboard[0].deletedCount;

    const formatEntry = (entry, index) => {
      const rank = index + 1;
      const barLength = 10;
      const filled = Math.round((entry.deletedCount / maxCount) * barLength);
      const bar = "█".repeat(filled) + "░".repeat(barLength - filled);

      let prefix;
      if (rank === 1) prefix = "🥇";
      else if (rank === 2) prefix = "🥈";
      else if (rank === 3) prefix = "🥉";
      else prefix = `\`${rank.toString().padStart(2, " ")}\``;

      return `${prefix} <@${entry.userId}>\n\`${bar}\` **${entry.deletedCount}**`;
    };

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle("قائمة أسوأ ناشري الميمز")
      .setDescription(leaderboard.map(formatEntry).join("\n\n"))
      .setThumbnail(interaction.guild.iconURL({ size: 128 }))
      .setFooter({ text: `إجمالي المستخدمين: ${leaderboard.length}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (sub === "resetstats") {
    const user = interaction.options.getUser("user");
    if (user) {
      resetUserStats(guildId, user.id);
      await interaction.reply({ ephemeral: true, content: `تم إعادة تعيين إحصائيات ${user}` });
    } else {
      resetGuildStats(guildId);
      await interaction.reply({ ephemeral: true, content: `تم إعادة تعيين جميع الإحصائيات للسيرفر` });
    }
    return;
  }
});

// =============== أوامر GIF ===============
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "gif") return;
  if (!interaction.inGuild()) return;

  const member = interaction.member;
  if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ ephemeral: true, content: "ليس لديك صلاحية لاستخدام هذا الأمر." });
    return;
  }

  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();
  const config = getGuildConfig(guildId);

  if (sub === "status") {
    await interaction.reply({
      ephemeral: true,
      content:
        `**GIF Config**\n` +
        `- Channels: ${config.gifChannelIds.length ? config.gifChannelIds.map((id) => `<#${id}>`).join(", ") : "none"}\n` +
        `- Quality: ${config.gifQuality}\n` +
        `- Duration: ${config.gifDuration} ثوان\u064d\n` +
        `- Auto: ${config.gifAutoEnabled ? "مُفعّل" : "مُعطّل"}`,
    });
    return;
  }

  if (sub === "setchannel") {
    const channel = interaction.options.getChannel("channel", true);
    const ids = new Set(config.gifChannelIds);
    ids.add(channel.id);
    setGuildConfig(guildId, { gifChannelIds: Array.from(ids) });
    await interaction.reply({ ephemeral: true, content: `تمت إضافة ${channel} لقنوات GIF` });
    return;
  }

  if (sub === "removechannel") {
    const channel = interaction.options.getChannel("channel", true);
    const nextIds = config.gifChannelIds.filter((id) => id !== channel.id);
    setGuildConfig(guildId, { gifChannelIds: nextIds });
    await interaction.reply({ ephemeral: true, content: `تمت إزالة ${channel} من قنوات GIF` });
    return;
  }

  if (sub === "listchannels") {
    if (config.gifChannelIds.length === 0) {
      await interaction.reply({ ephemeral: true, content: "لا توجد قنوات GIF. استخدم `/gif setchannel`" });
      return;
    }
    const list = config.gifChannelIds.map((id) => `<#${id}>`).join("\n");
    await interaction.reply({ ephemeral: true, content: `**قنوات GIF:**\n${list}` });
    return;
  }

  if (sub === "quality") {
    const level = interaction.options.getString("level", true);
    setGuildConfig(guildId, { gifQuality: level });
    const names = { low: "منخفضة", medium: "متوسطة", high: "عالية" };
    await interaction.reply({ ephemeral: true, content: `تم ضبط الجودة: **${names[level]}**` });
    return;
  }

  if (sub === "duration") {
    const seconds = interaction.options.getInteger("seconds", true);
    setGuildConfig(guildId, { gifDuration: seconds });
    await interaction.reply({ ephemeral: true, content: `تم ضبط مدة الفيديو: **${seconds} ثانية**` });
    return;
  }

  if (sub === "toggle") {
    const status = interaction.options.getString("status", true);
    setGuildConfig(guildId, { gifAutoEnabled: status === "on" });
    await interaction.reply({ ephemeral: true, content: `التحويل التلقائي: **${status === "on" ? "مُفعّل" : "مُعطّل"}**` });
    return;
  }
});

// =============== التحويل التلقائي لـ GIF ===============
const processedGifMessages = new Set(); // تتبع الرسائل المعالجة

client.on("messageCreate", async (message) => {
  // تجاهل البوتات والـDM
  if (message.author.bot) return;
  if (!message.inGuild()) return;

  // تجاهل الرسائل المعالجة سابقاً
  if (processedGifMessages.has(message.id)) return;

  const guildId = message.guildId;
  const config = getGuildConfig(guildId);

  // التحقق من أن القناة في قائمة GIF
  if (!config.gifChannelIds || !config.gifChannelIds.includes(message.channelId)) return;

  // التحقق من أن التحويل التلقائي مفعّل
  if (!config.gifAutoEnabled) return;

  // التحقق من وجود مرفقات
  if (!message.attachments || message.attachments.size === 0) return;

  // تسجيل الرسالة كمعالجة
  processedGifMessages.add(message.id);

  // حذف من القائمة بعد 5 دقائق لتوفير الذاكرة
  setTimeout(() => processedGifMessages.delete(message.id), 5 * 60 * 1000);

  // معالجة أول مرفق مدعوم فقط
  let converted = false;
  for (const [, attachment] of message.attachments) {
    if (converted) break; // تحويل واحد فقط لكل رسالة
    if (!gifConverter.isSupported(attachment.name)) continue;

    // إضافة رد فعل المعالجة
    await safeReact(message, "⏳");

    try {
      console.log(`[GIF] Converting ${attachment.name} in #${message.channel.name}`);

      const result = await gifConverter.convertAttachment(attachment, {
        quality: config.gifQuality,
        duration: config.gifDuration,
      });

      // إرسال GIF
      const { AttachmentBuilder } = require("discord.js");
      const gifFile = new AttachmentBuilder(result.outputPath, { name: "converted.gif" });

      await message.reply({
        content: ` تم التحويل إلى GIF!`,
        files: [gifFile],
      });

      // إضافة رد فعل النجاح
      await safeReact(message, "✅");

      // تنظيف الملفات
      gifConverter.cleanupFile(result.inputPath);
      gifConverter.cleanupFile(result.outputPath);

      converted = true; // تم التحويل - لا نحتاج المزيد

    } catch (err) {
      console.error(`[GIF] Error converting ${attachment.name}:`, err.message);
      await safeReact(message, "❌");
      await message.reply({
        content: `❌ فشل التحويل: ${err.message}\n💡 تأكد من تثبيت ffmpeg للفيديوهات`,
      }).catch(() => { });
    }
  }
});

// =============== معالج رسائل الميمز ===============
client.on("messageCreate", async (message) => {
  // تجاهل البوتات والـDM
  if (message.author.bot) return;
  if (!message.inGuild()) return;

  const guildId = message.guildId;
  const config = getGuildConfig(guildId);

  // يعمل فقط في قنوات محددة
  if (!config.enabledChannelIds.includes(message.channelId)) return;

  // نراقب فقط رسائل تحتوي مرفقات صورة/فيديو
  if (!isMemeMessage(message)) return;

  // أضف رياكشنين ثم ابدأ المؤقّت
  await safeReact(message, config.emojis.positive);
  await safeReact(message, config.emojis.negative);

  const createdAtMs = message.createdTimestamp || Date.now();
  const endsAtMs = createdAtMs + config.durationMinutes * 60_000;

  scheduleFinalize(guildId, message.channelId, message.id, endsAtMs, createdAtMs);
});

client.login(token);

// =============== الوضع المستمر: فحص دوري للرسائل ===============
async function checkGuildMemes(guildId) {
  const config = getGuildConfig(guildId);
  if (config.mode !== "continuous") return;

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  for (const channelId of config.enabledChannelIds) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) continue;

    // جلب آخر 50 رسالة
    const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    if (!messages) continue;

    const posKey = parseEmojiKey(config.emojis.positive);
    const negKey = parseEmojiKey(config.emojis.negative);

    for (const [, msg] of messages) {
      // تجاهل رسائل بدون ميم
      if (!isMemeMessage(msg)) continue;

      const posReaction = msg.reactions.cache.get(posKey) || null;
      const negReaction = msg.reactions.cache.get(negKey) || null;

      const countUsers = async (r) => {
        if (!r) return 0;
        const users = await r.users.fetch().catch(() => null);
        if (!users) return 0;
        return users.filter((u) => !u.bot).size;
      };

      const pos = await countUsers(posReaction);
      const neg = await countUsers(negReaction);

      if (neg > pos) {
        // إلغاء المؤقت إذا كان موجوداً
        if (scheduled.has(msg.id)) {
          clearTimeout(scheduled.get(msg.id));
          scheduled.delete(msg.id);
          removePending(msg.id);
        }
        // تسجيل الإحصائيات
        if (msg.author?.id) {
          incrementDeleteCount(guildId, msg.author.id);
        }
        await sendDeleteLog(guild, config, msg, pos, neg, "التصويت السلبي أعلى (الوضع المستمر)");
        await msg.delete().catch(() => null);
        console.log(`[Continuous] Deleted meme ${msg.id} (pos: ${pos}, neg: ${neg})`);
      }
    }
  }
}

function startContinuousCheck(guildId) {
  // إيقاف أي فحص سابق
  stopContinuousCheck(guildId);

  const config = getGuildConfig(guildId);
  const intervalMs = (config.checkIntervalSeconds || 30) * 1000;

  const intervalId = setInterval(() => {
    checkGuildMemes(guildId).catch(console.error);
  }, intervalMs);

  continuousIntervals.set(guildId, intervalId);
  console.log(`[Continuous] Started checking guild ${guildId} every ${config.checkIntervalSeconds || 30}s`);
}

function stopContinuousCheck(guildId) {
  if (continuousIntervals.has(guildId)) {
    clearInterval(continuousIntervals.get(guildId));
    continuousIntervals.delete(guildId);
    console.log(`[Continuous] Stopped checking guild ${guildId}`);
  }
}




