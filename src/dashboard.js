const express = require("express");
const cors = require("cors");
const path = require("path");
const { getGuildConfig, setGuildConfig } = require("./configStore");
const { getLeaderboard, resetUserStats, resetGuildStats } = require("./statsStore");

const app = express();
// تغيير المنفذ ليتوافق مع Render تلقائياً
const PORT = process.env.PORT || 3000; 

app.use(cors());
app.use(express.json());

// تأكد أن مسار المجلد يشير للمكان الصحيح لملفات index.html و app.js
// إذا كان مجلد dashboard في المجلد الرئيسي للمشروع:
app.use(express.static(path.join(__dirname, "..", "dashboard")));

// ... (أبقِ جميع مسارات الـ API كما هي)

function startDashboard(client) {
    // ... (أبقِ مسارات الـ API داخل الدالة كما هي)

    // حل مشكلة Not Found: هذا المسار يعرض ملف الواجهة عند الدخول للرابط الأساسي
    app.get("/", (req, res) => {
        res.sendFile(path.join(__dirname, "..", "dashboard", "index.html"));
    });

    // تشغيل السيرفر على 0.0.0.0 ليتمكن Render من الوصول إليه
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 [Dashboard] Running at port ${PORT}`);
    });
}

module.exports = { startDashboard };


