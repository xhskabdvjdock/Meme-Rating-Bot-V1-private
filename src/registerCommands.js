require("dotenv").config({ path: ".env" });
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  console.error("Missing DISCORD_TOKEN or CLIENT_ID. Put them in ./env (see env.example).");
  process.exit(1);
}

const memerate = new SlashCommandBuilder()
  .setName("memerate")
  .setDescription("إعدادات بوت تقييم الميمز")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sc) =>
    sc
      .setName("status")
      .setDescription("عرض الإعدادات الحالية")
  )
  .addSubcommand((sc) =>
    sc
      .setName("setduration")
      .setDescription("تحديد مدة التصويت بالدقائق")
      .addIntegerOption((opt) =>
        opt
          .setName("minutes")
          .setDescription("مثال: 10 أو 30")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(24 * 60)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("setemojis")
      .setDescription("تحديد إيموجيات التصويت")
      .addStringOption((opt) =>
        opt.setName("positive").setDescription("إيموجي التقييم الإيجابي (مثال ✅ أو <:up:123>)").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("negative").setDescription("إيموجي التقييم السلبي (مثال ❌ أو <:down:123>)").setRequired(true)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("addchannel")
      .setDescription("إضافة قناة للمراقبة")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("القناة التي يراقبها البوت")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("removechannel")
      .setDescription("إزالة قناة من المراقبة")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("القناة التي تريد إيقاف مراقبتها")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("setmode")
      .setDescription("تحديد وضع الفحص: مستمر أو مؤقت")
      .addStringOption((opt) =>
        opt
          .setName("mode")
          .setDescription("وضع الفحص")
          .setRequired(true)
          .addChoices(
            { name: "مستمر (يحذف فوراً عند تجاوز السلبي)", value: "continuous" },
            { name: "مؤقت (يفحص بعد انتهاء المدة فقط)", value: "timed" }
          )
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("setinterval")
      .setDescription("تحديد الفترة بين كل فحص في الوضع المستمر")
      .addIntegerOption((opt) =>
        opt
          .setName("seconds")
          .setDescription("الفترة بالثواني (مثال: 30 أو 60)")
          .setRequired(true)
          .setMinValue(5)
          .setMaxValue(3600)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("setlogchannel")
      .setDescription("تحديد قناة سجل الميمز المحذوفة")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("القناة التي سيُرسل إليها سجل الحذف (اتركها فارغة لإيقاف السجل)")
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("worstmemes")
      .setDescription("عرض قائمة أسوأ ناشري الميمز")
      .addIntegerOption((opt) =>
        opt
          .setName("limit")
          .setDescription("عدد المستخدمين للعرض (الافتراضي: 10)")
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(25)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("resetstats")
      .setDescription("إعادة تعيين إحصائيات مستخدم أو السيرفر كامل")
      .addUserOption((opt) =>
        opt
          .setName("user")
          .setDescription("المستخدم لإعادة تعيين إحصائياته (اتركه فارغاً لإعادة تعيين السيرفر)")
          .setRequired(false)
      )
  );

// =============== أوامر GIF ===============
const gifcommands = new SlashCommandBuilder()
  .setName("gif")
  .setDescription("إعدادات تحويل الصور والفيديوهات إلى GIF")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sc) =>
    sc
      .setName("setchannel")
      .setDescription("إضافة قناة للسماح بتحويل GIF")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("القناة المراد إضافتها")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("removechannel")
      .setDescription("إزالة قناة من قائمة تحويل GIF")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("القناة المراد إزالتها")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
  )
  .addSubcommand((sc) =>
    sc.setName("listchannels").setDescription("عرض قنوات تحويل GIF")
  )
  .addSubcommand((sc) =>
    sc
      .setName("quality")
      .setDescription("ضبط جودة GIF")
      .addStringOption((opt) =>
        opt
          .setName("level")
          .setDescription("مستوى الجودة")
          .setRequired(true)
          .addChoices(
            { name: "منخفضة (حجم أصغر)", value: "low" },
            { name: "متوسطة", value: "medium" },
            { name: "عالية (حجم أكبر)", value: "high" }
          )
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("duration")
      .setDescription("تحديد مدة الفيديو المحول (بالثواني)")
      .addIntegerOption((opt) =>
        opt
          .setName("seconds")
          .setDescription("المدة بالثواني (1-15)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(15)
      )
  )
  .addSubcommand((sc) =>
    sc
      .setName("toggle")
      .setDescription("تفعيل/تعطيل التحويل التلقائي")
      .addStringOption((opt) =>
        opt
          .setName("status")
          .setDescription("الحالة")
          .setRequired(true)
          .addChoices(
            { name: "تفعيل", value: "on" },
            { name: "تعطيل", value: "off" }
          )
      )
  )
  .addSubcommand((sc) =>
    sc.setName("status").setDescription("عرض إعدادات GIF الحالية")
  );

async function main() {
  const rest = new REST({ version: "10" }).setToken(token);
  const commands = [memerate.toJSON(), gifcommands.toJSON()];
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log("Registered slash commands globally.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


