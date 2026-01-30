const express = require("express");
const cors = require("cors");
const path = require("path");
const { getGuildConfig, setGuildConfig } = require("./configStore");
const { getLeaderboard, resetUserStats, resetGuildStats } = require("./statsStore");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "dashboard")));

// الحصول على إعدادات سيرفر
app.get("/api/guilds/:guildId/config", (req, res) => {
    const config = getGuildConfig(req.params.guildId);
    res.json(config);
});

// تحديث إعدادات سيرفر
app.patch("/api/guilds/:guildId/config", (req, res) => {
    const guildId = req.params.guildId;
    const updates = req.body;
    const newConfig = setGuildConfig(guildId, updates);
    res.json(newConfig);
});

// الحصول على قائمة أسوأ الناشرين
app.get("/api/guilds/:guildId/leaderboard", (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = getLeaderboard(req.params.guildId, limit);
    res.json(leaderboard);
});

// إعادة تعيين إحصائيات مستخدم
app.delete("/api/guilds/:guildId/stats/:userId", (req, res) => {
    resetUserStats(req.params.guildId, req.params.userId);
    res.json({ success: true });
});

// إعادة تعيين إحصائيات السيرفر
app.delete("/api/guilds/:guildId/stats", (req, res) => {
    resetGuildStats(req.params.guildId);
    res.json({ success: true });
});

function startDashboard(client) {
    // إضافة endpoint للحصول على معلومات السيرفرات
    app.get("/api/guilds", (req, res) => {
        const guilds = client.guilds.cache.map(g => ({
            id: g.id,
            name: g.name,
            icon: g.iconURL({ size: 128 }),
            memberCount: g.memberCount,
        }));
        res.json(guilds);
    });

    // الحصول على قنوات سيرفر
    app.get("/api/guilds/:guildId/channels", async (req, res) => {
        const guild = client.guilds.cache.get(req.params.guildId);
        if (!guild) return res.status(404).json({ error: "Guild not found" });

        const channels = guild.channels.cache
            .filter(c => c.type === 0 || c.type === 5) // Text & Announcement
            .map(c => ({ id: c.id, name: c.name, type: c.type }));
        res.json(channels);
    });

    // الصفحة الرئيسية - catch all (يجب أن تكون في النهاية)
    app.get("/", (req, res) => {
        res.sendFile(path.join(__dirname, "..", "dashboard", "index.html"));
    });

    app.listen(PORT, () => {
        console.log(`[Dashboard] Running at http://localhost:${PORT}`);
    });
}

module.exports = { startDashboard };

