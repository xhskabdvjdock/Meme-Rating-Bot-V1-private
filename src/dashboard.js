const express = require("express");
const cors = require("cors");
const path = require("path");
const { getGuildConfig, setGuildConfig } = require("./configStore");
const { getLeaderboard, resetUserStats, resetGuildStats } = require("./statsStore");

const app = express();
// Render يفضل استخدام المنفذ 10000 دائماً
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// تشغيل الملفات الثابتة (HTML, CSS, JS) فوراً
app.use(express.static(path.join(__dirname, "..", "dashboard")));

let discordClient = null;

// --- مسارات الـ API (تعمل دائماً) ---

// الحصول على قائمة السيرفرات
app.get("/api/guilds", (req, res) => {
    if (!discordClient) return res.status(503).json({ error: "البوت قيد التشغيل، انتظر لحظة..." });
    const guilds = discordClient.guilds.cache.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.iconURL({ size: 128 }),
        memberCount: g.memberCount,
    }));
    res.json(guilds);
});

// الحصول على قنوات سيرفر معين
app.get("/api/guilds/:guildId/channels", async (req, res) => {
    if (!discordClient) return res.status(503).json({ error: "Client not ready" });
    const guild = discordClient.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const channels = guild.channels.cache
        .filter(c => c.type === 0 || c.type === 5) // Text & Announcement
        .map(c => ({ id: c.id, name: c.name, type: c.type }));
    res.json(channels);
});

// المسارات الأخرى (الإحصائيات والإعدادات)
app.get("/api/guilds/:guildId/config", (req, res) => res.json(getGuildConfig(req.params.guildId)));
app.patch("/api/guilds/:guildId/config", (req, res) => res.json(setGuildConfig(req.params.guildId, req.body)));
app.get("/api/guilds/:guildId/leaderboard", (req, res) => res.json(getLeaderboard(req.params.guildId, parseInt(req.query.limit) || 10)));
app.delete("/api/guilds/:guildId/stats", (req, res) => {
    resetGuildStats(req.params.guildId);
    res.json({ success: true });
});

// توجيه أي طلب غير معروف إلى index.html لحل مشكلة 404
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "dashboard", "index.html"));
});

// تشغيل السيرفر فوراً عند تشغيل البوت
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [Dashboard] Server is live on port ${PORT}`);
});

// دالة الربط التي يستدعيها bot.js
function startDashboard(client) {
    discordClient = client;
    console.log("✅ [Dashboard] Discord client linked successfully.");
}

module.exports = { startDashboard };

