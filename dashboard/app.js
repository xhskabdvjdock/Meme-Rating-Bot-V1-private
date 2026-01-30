const express = require('express');
const path = require('path');
const app = express();

// 1. تحديد المنفذ (مهم جداً لـ Render)
const port = process.env.PORT || 3000;

// 2. أخبر السيرفر أين توجد ملفات الـ Dashboard (مثل app.js و index.html)
// افترضنا هنا أن ملفاتك داخل مجلد اسمه public
app.use(express.static(path.join(__dirname, '../public')));

// 3. مسار تشغيل الواجهة
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 4. تشغيل السيرفر
app.listen(port, '0.0.0.0', () => {
  console.log(`Dashboard is live on: http://localhost:${port}`);
});

// =============== Theme Toggle ===============
function initTheme() {
    const savedTheme = localStorage.getItem('dashboard-theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('dashboard-theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

async function loadServers() {
    try {
        const res = await fetch(`${API}/api/guilds`);
        guilds = await res.json();
        renderServers();
    } catch (err) {
        console.error('Error loading servers:', err);
        serversList.innerHTML = '<div class="loading">خطأ في الاتصال بالسيرفر</div>';
    }
}

function renderServers() {
    if (guilds.length === 0) {
        serversList.innerHTML = '<div class="loading">لا توجد سيرفرات</div>';
        return;
    }

    serversList.innerHTML = guilds.map(g => `
    <div class="server-card" onclick="openServer('${g.id}')">
      <div class="server-icon">
        ${g.icon ? `<img src="${g.icon}" alt="${g.name}">` : g.name.charAt(0)}
      </div>
      <div class="server-info">
        <h3>${g.name}</h3>
        <span>${g.memberCount} عضو</span>
      </div>
    </div>
  `).join('');
}

async function openServer(guildId) {
    currentGuildId = guildId;
    const guild = guilds.find(g => g.id === guildId);
    pageTitle.textContent = guild.name;

    // Show sub navigation
    subNav.style.display = 'block';

    // Load data
    await Promise.all([
        loadChannels(),
        loadConfig()
    ]);

    // Show default system (meme rate)
    showSystem('memerate');
}

function showServers() {
    pageTitle.textContent = 'السيرفرات';
    subNav.style.display = 'none';

    // Hide all pages
    serversPage.classList.add('active');
    memeratePage.classList.remove('active');
    gifPage.classList.remove('active');

    // Reset nav items
    document.querySelectorAll('.sub-nav .nav-item').forEach(el => el.classList.remove('active'));
}

function showSystem(system) {
    currentSystem = system;

    // Hide all system pages
    serversPage.classList.remove('active');
    memeratePage.classList.remove('active');
    gifPage.classList.remove('active');

    // Show selected system
    if (system === 'memerate') {
        memeratePage.classList.add('active');
        loadLeaderboard();
    } else if (system === 'gif') {
        gifPage.classList.add('active');
    }

    // Update nav
    document.querySelectorAll('.sub-nav .nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.system === system);
    });
}

function showPage(page) {
    if (page === 'servers') {
        showServers();
    }
}

// =============== Config ===============

async function loadConfig() {
    try {
        const res = await fetch(`${API}/api/guilds/${currentGuildId}/config`);
        config = await res.json();

        // Meme Rate settings
        document.getElementById('mode-select').value = config.mode || 'timed';
        document.getElementById('duration-input').value = config.durationMinutes || 10;
        document.getElementById('interval-input').value = config.checkIntervalSeconds || 30;
        document.getElementById('positive-emoji').value = config.emojis?.positive || '✅';
        document.getElementById('negative-emoji').value = config.emojis?.negative || '❌';

        // GIF settings
        document.getElementById('gif-auto-select').value = config.gifAutoEnabled !== false ? 'true' : 'false';
        document.getElementById('gif-quality-select').value = config.gifQuality || 'medium';
        document.getElementById('gif-duration-input').value = config.gifDuration || 5;

        updateIntervalVisibility();
        renderEnabledChannels();
        renderChannelSelects();
        renderGifChannels();
        renderGifChannelSelect();
    } catch (err) {
        console.error('Error loading config:', err);
        showToast('خطأ في تحميل الإعدادات', 'error');
    }
}

function updateIntervalVisibility() {
    const mode = document.getElementById('mode-select').value;
    document.getElementById('interval-group').style.display = mode === 'continuous' ? 'block' : 'none';
}

document.getElementById('mode-select').addEventListener('change', updateIntervalVisibility);

async function loadChannels() {
    try {
        const res = await fetch(`${API}/api/guilds/${currentGuildId}/channels`);
        channels = await res.json();
    } catch (err) {
        console.error('Error loading channels:', err);
        channels = [];
    }
}

// =============== Meme Rate Channels ===============

function renderEnabledChannels() {
    const list = document.getElementById('channels-list');
    const enabledIds = config.enabledChannelIds || [];

    if (enabledIds.length === 0) {
        list.innerHTML = '<div class="empty-state">لا توجد قنوات مراقبة</div>';
        return;
    }

    list.innerHTML = enabledIds.map(id => {
        const channel = channels.find(c => c.id === id);
        return `
      <div class="channel-item">
        <span># ${channel?.name || id}</span>
        <button onclick="removeChannel('${id}')">×</button>
      </div>
    `;
    }).join('');
}

function renderChannelSelects() {
    const addSelect = document.getElementById('add-channel-select');
    const logSelect = document.getElementById('log-channel-select');
    const enabledIds = config.enabledChannelIds || [];

    const availableChannels = channels.filter(c => !enabledIds.includes(c.id));

    addSelect.innerHTML = '<option value="">اختر قناة...</option>' +
        availableChannels.map(c => `<option value="${c.id}"># ${c.name}</option>`).join('');

    logSelect.innerHTML = '<option value="">بدون سجل</option>' +
        channels.map(c => `<option value="${c.id}" ${config.logChannelId === c.id ? 'selected' : ''}># ${c.name}</option>`).join('');
}

async function saveConfig() {
    try {
        const updates = {
            mode: document.getElementById('mode-select').value,
            durationMinutes: parseInt(document.getElementById('duration-input').value),
            checkIntervalSeconds: parseInt(document.getElementById('interval-input').value),
            emojis: {
                positive: document.getElementById('positive-emoji').value,
                negative: document.getElementById('negative-emoji').value
            }
        };

        await fetch(`${API}/api/guilds/${currentGuildId}/config`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        showToast('تم حفظ الإعدادات', 'success');
        await loadConfig();
    } catch (err) {
        console.error('Error saving config:', err);
        showToast('خطأ في حفظ الإعدادات', 'error');
    }
}

async function addChannel() {
    const select = document.getElementById('add-channel-select');
    const channelId = select.value;
    if (!channelId) return;

    try {
        const newList = [...(config.enabledChannelIds || []), channelId];
        await fetch(`${API}/api/guilds/${currentGuildId}/config`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabledChannelIds: newList })
        });

        showToast('تمت إضافة القناة', 'success');
        await loadConfig();
    } catch (err) {
        console.error('Error adding channel:', err);
        showToast('خطأ في إضافة القناة', 'error');
    }
}

async function removeChannel(channelId) {
    try {
        const newList = (config.enabledChannelIds || []).filter(id => id !== channelId);
        await fetch(`${API}/api/guilds/${currentGuildId}/config`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabledChannelIds: newList })
        });

        showToast('تمت إزالة القناة', 'success');
        await loadConfig();
    } catch (err) {
        console.error('Error removing channel:', err);
        showToast('خطأ في إزالة القناة', 'error');
    }
}

async function saveLogChannel() {
    try {
        const channelId = document.getElementById('log-channel-select').value;
        await fetch(`${API}/api/guilds/${currentGuildId}/config`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logChannelId: channelId || null })
        });

        showToast('تم حفظ قناة السجل', 'success');
    } catch (err) {
        console.error('Error saving log channel:', err);
        showToast('خطأ في حفظ قناة السجل', 'error');
    }
}

// =============== Leaderboard ===============

async function loadLeaderboard() {
    try {
        const res = await fetch(`${API}/api/guilds/${currentGuildId}/leaderboard?limit=10`);
        const leaderboard = await res.json();

        const container = document.getElementById('leaderboard');

        if (leaderboard.length === 0) {
            container.innerHTML = '<div class="empty-state">لا توجد إحصائيات</div>';
            return;
        }

        container.innerHTML = leaderboard.map((entry, i) => {
            let rankClass = '';
            if (i === 0) rankClass = 'gold';
            else if (i === 1) rankClass = 'silver';
            else if (i === 2) rankClass = 'bronze';

            return `
          <div class="leaderboard-item">
            <div class="leaderboard-rank ${rankClass}">${i + 1}</div>
            <div class="leaderboard-info">
              <div class="name">User ${entry.userId.slice(-4)}</div>
              <div class="count">${entry.deletedCount} ميم محذوف</div>
            </div>
          </div>
        `;
        }).join('');
    } catch (err) {
        console.error('Error loading leaderboard:', err);
    }
}

async function resetAllStats() {
    if (!confirm('هل أنت متأكد من إعادة تعيين جميع الإحصائيات؟')) return;

    try {
        await fetch(`${API}/api/guilds/${currentGuildId}/stats`, { method: 'DELETE' });
        showToast('تم إعادة تعيين الإحصائيات', 'success');
        await loadLeaderboard();
    } catch (err) {
        console.error('Error resetting stats:', err);
        showToast('خطأ في إعادة تعيين الإحصائيات', 'error');
    }
}

// =============== GIF System ===============

function renderGifChannels() {
    const list = document.getElementById('gif-channels-list');
    const gifIds = config.gifChannelIds || [];

    if (gifIds.length === 0) {
        list.innerHTML = '<div class="empty-state">لا توجد قنوات GIF</div>';
        return;
    }

    list.innerHTML = gifIds.map(id => {
        const channel = channels.find(c => c.id === id);
        return `
      <div class="channel-item">
        <span># ${channel?.name || id}</span>
        <button onclick="removeGifChannel('${id}')">×</button>
      </div>
    `;
    }).join('');
}

function renderGifChannelSelect() {
    const select = document.getElementById('add-gif-channel-select');
    const gifIds = config.gifChannelIds || [];
    const availableChannels = channels.filter(c => !gifIds.includes(c.id));

    select.innerHTML = '<option value="">اختر قناة...</option>' +
        availableChannels.map(c => `<option value="${c.id}"># ${c.name}</option>`).join('');
}

async function saveGifConfig() {
    try {
        const updates = {
            gifAutoEnabled: document.getElementById('gif-auto-select').value === 'true',
            gifQuality: document.getElementById('gif-quality-select').value,
            gifDuration: parseInt(document.getElementById('gif-duration-input').value)
        };

        await fetch(`${API}/api/guilds/${currentGuildId}/config`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        showToast('تم حفظ إعدادات GIF', 'success');
        await loadConfig();
    } catch (err) {
        console.error('Error saving GIF config:', err);
        showToast('خطأ في حفظ إعدادات GIF', 'error');
    }
}

async function addGifChannel() {
    const select = document.getElementById('add-gif-channel-select');
    const channelId = select.value;
    if (!channelId) return;

    try {
        const newList = [...(config.gifChannelIds || []), channelId];
        await fetch(`${API}/api/guilds/${currentGuildId}/config`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gifChannelIds: newList })
        });

        showToast('تمت إضافة قناة GIF', 'success');
        await loadConfig();
    } catch (err) {
        console.error('Error adding GIF channel:', err);
        showToast('خطأ في إضافة القناة', 'error');
    }
}

async function removeGifChannel(channelId) {
    try {
        const newList = (config.gifChannelIds || []).filter(id => id !== channelId);
        await fetch(`${API}/api/guilds/${currentGuildId}/config`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gifChannelIds: newList })
        });

        showToast('تمت إزالة قناة GIF', 'success');
        await loadConfig();
    } catch (err) {
        console.error('Error removing GIF channel:', err);
        showToast('خطأ في إزالة القناة', 'error');
    }
}

// =============== Toast ===============

function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

