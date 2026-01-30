// src/dashboard.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const { getGuildConfig, setGuildConfig } = require("./configStore");
const { getLeaderboard, resetUserStats, resetGuildStats } = require("./statsStore");

const app = express();

// استخدام PORT ليتوافق مع نظام Render التلقائي
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// تحديد مجلد ملفات الواجهة (app.js و index.html)
app.use(express.static(path.join(__dirname, "..", "dashboard")));

// مسارات الـ API
app.get("/api/guilds/:guildId/config", (req, res) => res.json(getGuildConfig(req.params.guildId)));
app.patch("/api/guilds/:guildId/config", (req, res) => res.json(setGuildConfig(req.params.guildId, req.body)));
app.get("/api/guilds/:guildId/leaderboard", (req, res) => res.json(getLeaderboard(req.params.guildId, parseInt(req.query.limit) || 10)));

function startDashboard(client) {
    // جلب قائمة السيرفرات
    app.get("/api/guilds", (req, res) => {
        const guilds = client.guilds.cache.map(g => ({
            id: g.id,
            name: g.name,
            icon: g.iconURL({ size: 128 }),
            memberCount: g.memberCount,
        }));
        res.json(guilds);
    });

    app.get("/api/guilds/:guildId/channels", async (req, res) => {
        const guild = client.guilds.cache.get(req.params.guildId);
        if (!guild) return res.status(404).json({ error: "Guild not found" });
        res.json(guild.channels.cache.filter(c => c.type === 0 || c.type === 5).map(c => ({ id: c.id, name: c.name })));
    });

    // حل مشكلة Not Found: توجيه أي طلب غير معروف إلى صفحة الداشبورد
    app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "..", "dashboard", "index.html"));
    });

    // الاستماع على المنفذ الصحيح وواجهة الشبكة المطلوبة لـ Render
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 [Dashboard] لوحة التحكم تعمل على المنفذ: ${PORT}`);
    });
}

module.exports = { startDashboard };
