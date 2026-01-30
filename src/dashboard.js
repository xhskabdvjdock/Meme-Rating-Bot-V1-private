const express = require("express");
const cors = require("cors");
const path = require("path");
const { getGuildConfig, setGuildConfig } = require("./configStore");
const { getLeaderboard, resetUserStats, resetGuildStats } = require("./statsStore");

const app = express();
const PORT = process.env.PORT || 10000; // المنفذ الخاص بـ Render

app.use(cors());
app.use(express.json());

// تحديد مجلد ملفات الواجهة (تأكد أن مجلد dashboard في المجلد الرئيسي)
app.use(express.static(path.join(__dirname, "..", "dashboard")));

let discordClient = null;

// --- مسارات الـ API ---
app.get("/api/guilds", (req, res) => {
    if (!discordClient) return res.status(503).json({ error: "البوت لا يزال قيد التشغيل..." });
    const guilds = discordClient.guilds.cache.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.iconURL({ size: 128 }),
        memberCount: g.memberCount,
    }));
    res.json(guilds);
});

app.get("/api/guilds/:guildId/config", (req, res) => res.json(getGuildConfig(req.params.guildId)));
app.patch("/api/guilds/:guildId/config", (req, res) => res.json(setGuildConfig(req.params.guildId, req.body)));

// حل مشكلة Not Found: توجيه أي طلب غير معروف إلى صفحة index.html
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "dashboard", "index.html"));
});

// تشغيل السيرفر فوراً لمرة واحدة فقط لمنع خطأ EADDRINUSE
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [Dashboard] السيرفر يعمل على المنفذ: ${PORT}`);
});

function startDashboard(client) {
    discordClient = client;
    console.log("✅ [Dashboard] تم ربط ديسكورد بالسيرفر بنجاح.");
}

module.exports = { startDashboard };
