// State
let currentGuildId = null;
let currentSystem = 'memerate';
let guilds = [];
let userGuilds = [];
let channels = [];
let config = {};
let currentUser = null;
let botGuilds = [];

// API Base
const API = '';

// DOM Elements
const serversPage = document.getElementById('servers-page');
const memeratePage = document.getElementById('memerate-page');
const gifPage = document.getElementById('gif-page');
const streakPage = document.getElementById('streak-page');
const pageTitle = document.getElementById('page-title');
const serversList = document.getElementById('servers-list');
const subNav = document.getElementById('sub-nav');
const userSection = document.getElementById('user-section');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    await checkAuth();
});

// =============== Authentication ===============
async function checkAuth() {
    try {
        const res = await fetch(`${API}/api/user`, { credentials: 'include' });
        const data = await res.json();

        if (data.loggedIn) {
            currentUser = data.user;
            renderUserSection(true);
            await loadUserGuilds();
        } else {
            currentUser = null;
            renderUserSection(false);
            renderLoginRequired();
        }
    } catch (err) {
        console.error('Error checking auth:', err);
        renderUserSection(false);
        renderLoginRequired();
    }
}

function renderUserSection(loggedIn) {
    if (loggedIn && currentUser) {
        const avatarUrl = currentUser.avatar
            ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`
            : null;

        userSection.innerHTML = `
            <div class="user-info">
                ${avatarUrl
                ? `<img src="${avatarUrl}" class="user-avatar" alt="">`
                : `<div class="user-avatar-placeholder">${currentUser.username.charAt(0).toUpperCase()}</div>`
            }
                <div class="user-details">
                    <div class="user-name">${currentUser.globalName || currentUser.username}</div>
                    <div class="user-tag">@${currentUser.username}</div>
                </div>
            </div>
            <a href="/auth/logout" class="logout-btn">تسجيل الخروج</a>
        `;
    } else {
        userSection.innerHTML = `
            <a href="/auth/login" class="login-btn">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                تسجيل الدخول بـ Discord
            </a>
        `;
    }
}

function renderLoginRequired() {
    serversList.innerHTML = `
        <div class="login-required">
            <h2>🔐 تسجيل الدخول مطلوب</h2>
            <p>سجل دخولك بحساب Discord لعرض السيرفرات التي يمكنك إدارتها</p>
            <a href="/auth/login" class="login-btn">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                تسجيل الدخول بـ Discord
            </a>
        </div>
    `;
}

async function loadUserGuilds() {
    try {
        // جلب سيرفرات المستخدم والبوت معاً
        const [userRes, botRes] = await Promise.all([
            fetch(`${API}/api/user/guilds`, { credentials: 'include' }),
            fetch(`${API}/api/guilds`)
        ]);

        userGuilds = await userRes.json();
        botGuilds = await botRes.json();

        renderUserServers();
    } catch (err) {
        console.error('Error loading user guilds:', err);
        serversList.innerHTML = '<div class="loading">خطأ في تحميل السيرفرات</div>';
    }
}

function renderUserServers() {
    if (userGuilds.length === 0) {
        serversList.innerHTML = '<div class="loading">لا توجد سيرفرات يمكنك إدارتها</div>';
        return;
    }

    // تحديد السيرفرات التي فيها البوت
    const botGuildIds = botGuilds.map(g => g.id);

    serversList.innerHTML = userGuilds.map(g => {
        const hasBot = botGuildIds.includes(g.id);
        const botInfo = hasBot ? botGuilds.find(bg => bg.id === g.id) : null;

        return `
        <div class="server-card ${hasBot ? '' : 'no-bot'}">
            <div class="server-icon">
                ${g.icon ? `<img src="${g.icon}" alt="${g.name}">` : g.name.charAt(0)}
            </div>
            <div class="server-info">
                <h3>${g.name}</h3>
                ${hasBot
                ? `<span>${botInfo?.memberCount || ''} عضو</span>
                       <div class="bot-status active">✓ البوت مضاف</div>
                       <button class="manage-btn" onclick="openServer('${g.id}')">
                           ⚙️ إدارة البوت
                       </button>`
                : `<div class="bot-status inactive">البوت غير مضاف</div>
                       <button class="add-bot-btn" onclick="addBot('${g.id}')">
                           ➕ إضافة البوت
                       </button>`
            }
            </div>
        </div>
        `;
    }).join('');
}

async function addBot(guildId) {
    try {
        const res = await fetch(`${API}/api/bot-invite/${guildId}`);
        const data = await res.json();
        window.open(data.url, '_blank', 'width=500,height=800');
    } catch (err) {
        console.error('Error getting bot invite:', err);
        // Fallback to general invite
        window.open(`https://discord.com/oauth2/authorize?client_id=${window.CLIENT_ID || ''}&permissions=93248&scope=bot+applications.commands&guild_id=${guildId}`, '_blank');
    }
}

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

// Legacy function - kept for compatibility
async function loadServers() {
    await loadUserGuilds();
}

function renderServers() {
    renderUserServers();
}


async function openServer(guildId) {
    console.log("[Dashboard] Opening server:", guildId);
    currentGuildId = guildId;

    // البحث في botGuilds أو userGuilds
    let guild = botGuilds.find(g => g.id === guildId);
    if (!guild) {
        guild = userGuilds.find(g => g.id === guildId);
    }

    if (!guild) {
        console.error("[Dashboard] Guild not found:", guildId);
        alert('حدث خطأ: السيرفر غير موجود');
        return;
    }

    pageTitle.textContent = guild.name;

    // Show sub navigation
    subNav.style.display = 'block';

    // Hide servers page, show system pages
    serversPage.classList.remove('active');

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
    streakPage.classList.remove('active');

    // Reset nav items
    document.querySelectorAll('.sub-nav .nav-item').forEach(el => el.classList.remove('active'));
}

function showSystem(system) {
    currentSystem = system;

    // Hide all system pages
    serversPage.classList.remove('active');
    memeratePage.classList.remove('active');
    gifPage.classList.remove('active');
    streakPage.classList.remove('active');

    // Show selected system
    if (system === 'memerate') {
        memeratePage.classList.add('active');
        loadLeaderboard();
    } else if (system === 'gif') {
        gifPage.classList.add('active');
    } else if (system === 'streak') {
        streakPage.classList.add('active');
        loadStreakChannels();
        loadStreakLeaderboard();
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
    const guildIdToLoad = currentGuildId; // حفظ الـ guildId الحالي
    try {
        const res = await fetch(`${API}/api/guilds/${guildIdToLoad}/config`);
        const fetchedConfig = await res.json();

        // التحقق إن المستخدم ما غيّر السيرفر أثناء التحميل
        if (currentGuildId !== guildIdToLoad) {
            return; // المستخدم غيّر السيرفر، نتجاهل هذا الرد
        }

        config = fetchedConfig;

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
        if (currentGuildId === guildIdToLoad) {
            showToast('خطأ في تحميل الإعدادات', 'error');
        }
    }
}

function updateIntervalVisibility() {
    const mode = document.getElementById('mode-select').value;
    document.getElementById('interval-group').style.display = mode === 'continuous' ? 'block' : 'none';
}

document.getElementById('mode-select').addEventListener('change', updateIntervalVisibility);

async function loadChannels() {
    const guildIdToLoad = currentGuildId; // حفظ الـ guildId الحالي
    try {
        const res = await fetch(`${API}/api/guilds/${guildIdToLoad}/channels`);
        const fetchedChannels = await res.json();

        // التحقق إن المستخدم ما غيّر السيرفر أثناء التحميل
        if (currentGuildId === guildIdToLoad) {
            channels = fetchedChannels;
        }
    } catch (err) {
        console.error('Error loading channels:', err);
        if (currentGuildId === guildIdToLoad) {
            channels = [];
        }
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

// =============== Streak System ===============

async function loadStreakChannels() {
    if (!config.streakChannelIds) {
        config.streakChannelIds = [];
    }

    // Populate channel select
    const select = document.getElementById('add-streak-channel-select');
    select.innerHTML = '<option value="">اختر قناة...</option>';

    channels.forEach(ch => {
        if (!config.streakChannelIds.includes(ch.id)) {
            select.innerHTML += `<option value="${ch.id}">#${ch.name}</option>`;
        }
    });

    renderStreakChannels();
}

function renderStreakChannels() {
    const container = document.getElementById('streak-channels-list');
    if (!config.streakChannelIds || config.streakChannelIds.length === 0) {
        container.innerHTML = '<p class="empty-state">لا توجد قنوات ستريك. أضف قناة لتفعيل النظام.</p>';
        return;
    }

    container.innerHTML = config.streakChannelIds.map(id => {
        const ch = channels.find(c => c.id === id);
        return `
            <div class="channel-item">
                <span>#${ch?.name || id}</span>
                <button class="btn danger small" onclick="removeStreakChannel('${id}')">إزالة</button>
            </div>
        `;
    }).join('');
}

async function addStreakChannel() {
    const select = document.getElementById('add-streak-channel-select');
    const channelId = select.value;
    if (!channelId) return;

    const ids = [...(config.streakChannelIds || []), channelId];

    try {
        const res = await fetch(`${API}/api/guilds/${currentGuildId}/config`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ streakChannelIds: ids })
        });
        config = await res.json();
        loadStreakChannels();
        showToast('تمت إضافة قناة الستريك ✅', 'success');
    } catch (err) {
        showToast('خطأ في إضافة القناة', 'error');
    }
}

async function removeStreakChannel(channelId) {
    const ids = (config.streakChannelIds || []).filter(id => id !== channelId);

    try {
        const res = await fetch(`${API}/api/guilds/${currentGuildId}/config`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ streakChannelIds: ids })
        });
        config = await res.json();
        loadStreakChannels();
        showToast('تمت إزالة القناة ❌', 'success');
    } catch (err) {
        showToast('خطأ في إزالة القناة', 'error');
    }
}

async function loadStreakLeaderboard() {
    const container = document.getElementById('streak-leaderboard');
    container.innerHTML = '<div class="loading">جاري التحميل...</div>';

    try {
        const res = await fetch(`${API}/api/guilds/${currentGuildId}/streaks?limit=10`);
        const streaks = await res.json();

        if (!streaks || streaks.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد بيانات ستريك بعد.</p>';
            return;
        }

        container.innerHTML = streaks.map((s, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            const badge = s.streak >= 30 ? '🏆' : s.streak >= 7 ? '⭐' : '';
            return `
                <div class="leaderboard-item">
                    <span class="rank">${medal}</span>
                    <span class="user-id">${s.userId}</span>
                    <span class="streak-count">🔥 ${s.streak} ${badge}</span>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = '<p class="empty-state">خطأ في تحميل البيانات</p>';
    }
}
