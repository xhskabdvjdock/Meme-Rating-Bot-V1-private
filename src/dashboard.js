const express = require("express");
const cors = require("cors");
const path = require("path");
const { getGuildConfig, setGuildConfig } = require("./configStore");
const { getLeaderboard, resetUserStats, resetGuildStats } = require("./statsStore");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// تحديد المسار للمجلد الذي يحتوي على واجهة التحكم
// تأكد أن المجلد في المشروع اسمه "dashboard" بالحروف الصغيرة
const dashboardPath = path.join(__dirname, "..", "dashboard");

// تشغيل الملفات الثابتة
app.use(express.static(dashboardPath));

let discordClient = null;

// --- مسارات الـ API ---
app.get("/api/guilds", (req, res) => {
    if (!discordClient) return res.status(503).json({ error: "Waiting for bot..." });
    const guilds = discordClient.guilds.cache.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.iconURL({ size: 128 }),
        memberCount: g.memberCount,
    }));
    res.json(guilds);
});

// أي مسار غير معروف، قم بإرسال index.html فوراً
app.get("*", (req, res) => {
    res.sendFile(path.join(dashboardPath, "index.html"), (err) => {
        if (err) {
            console.error("❌ لم يتم العثور على ملف index.html في المسار:", dashboardPath);
            res.status(404).send("Dashboard files missing on server");
        }
    });
});

// تشغيل السيرفر
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Dashboard server is running on port ${PORT}`);
});

function startDashboard(client) {
    discordClient = client;
    console.log("✅ Linked Discord Client to Dashboard");
}

module.exports = { startDashboard };
