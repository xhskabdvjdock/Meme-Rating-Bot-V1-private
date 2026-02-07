/**
 * Video Downloader Module - Using Cobalt API
 * تحميل الفيديوهات من YouTube, TikTok, Instagram باستخدام Cobalt API
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');

// إعدادات
const TEMP_DIR = path.join(__dirname, '..', 'temp');
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB Discord limit
// Default to official API (requires private instance or auth for heavy use)
const COBALT_API = process.env.COBALT_API_URL || 'https://api.cobalt.tools';

// أنماط الروابط المدعومة
const URL_PATTERNS = {
    youtube: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/gi,
    tiktok: /(?:https?:\/\/)?(?:www\.)?(?:vm\.)?tiktok\.com\/[@\w\/-]+/gi,
    instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|p)\/[\w-]+/gi,
};

// إنشاء مجلد temp إذا لم يكن موجوداً
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * تنسيق الوقت (ثواني -> HH:MM:SS)
 */
function formatDuration(duration) {
    if (!duration) return '00:00';
    const seconds = Math.floor(duration);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const mDisplay = m < 10 ? `0${m}` : m;
    const sDisplay = s < 10 ? `0${s}` : s;

    if (h > 0) {
        return `${h}:${mDisplay}:${sDisplay}`;
    }
    return `${mDisplay}:${sDisplay}`;
}

/**
 * الحصول على اسم المنصة
 */
function getPlatformName(platform) {
    const names = {
        youtube: 'YouTube',
        tiktok: 'TikTok',
        instagram: 'Instagram',
        twitter: 'Twitter',
        x: 'X',
    };
    return names[platform] || platform;
}

/**
 * اكتشاف روابط الفيديو في النص
 */
function detectVideoUrls(content) {
    const results = [];

    for (const [platform, pattern] of Object.entries(URL_PATTERNS)) {
        const matches = content.match(pattern);
        if (matches) {
            for (const url of matches) {
                const fullUrl = url.startsWith('http') ? url : `https://${url}`;
                results.push({ platform, url: fullUrl });
            }
        }
    }

    return results;
}

/**
 * الحصول على معلومات الفيديو من Cobalt API
 */
async function getVideoInfo(url) {
    try {
        const isV10 = !COBALT_API.includes('/api/json');

        let payload = {};
        if (isV10) {
            payload = {
                url: url,
            };
        } else {
            // v7 payload
            payload = {
                url: url,
                vQuality: '720',
                filenamePattern: 'basic'
            };
        }

        const response = await axios.post(COBALT_API, payload, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Origin': 'https://cobalt.tools',
                'Referer': 'https://cobalt.tools/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 30000
        });

        if (response.data.status === 'error' || response.data.status === 'rate-limit') {
            throw new Error(response.data.text || 'فشل في الحصول على معلومات الفيديو');
        }

        return {
            title: response.data.filename || 'video',
            thumbnail: null,
            duration: 0,
            uploader: null,
            url: url
        };
    } catch (error) {
        if (error.response?.status === 400 || error.response?.status === 401 || error.response?.status === 403) {
            throw new Error(`تعذر الوصول لخدمة التحميل (${error.response.status}). يرجى التحقق من إعدادات COBALT_API_URL.`);
        }
        if (error.response?.status === 429) {
            throw new Error('تم تجاوز حد الطلبات. حاول مجدداً بعد قليل');
        }
        throw new Error(error.response?.data?.text || error.message || 'فشل في الحصول على معلومات الفيديو');
    }
}

/**
 * تحميل الفيديو باستخدام Cobalt API
 */
async function downloadVideo(url, format = 'mp4', quality = 'best') {
    try {
        const downloadMode = format === 'mp3' ? 'audio' : 'auto';
        const isV10 = !COBALT_API.includes('/api/json');

        let payload = {};
        let videoQuality = '720';

        if (quality === 'best') videoQuality = 'max';
        else if (quality === '720') videoQuality = '720';
        else if (quality === '480') videoQuality = '480';

        if (isV10) {
            payload = {
                url: url,
                videoQuality: quality === 'best' ? 'max' : quality,
                audioFormat: 'mp3',
                filenameStyle: 'basic',
                downloadMode: downloadMode,
                youtubeVideoCodec: 'h264',
                alwaysProxy: true
            };
        } else {
            // v7 payload
            payload = {
                url: url,
                vQuality: videoQuality,
                aFormat: 'mp3',
                filenamePattern: 'basic',
                isAudioOnly: downloadMode === 'audio',
                vCodec: 'h264',
                isNoTTWatermark: true
            };
        }

        const response = await axios.post(COBALT_API, payload, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Origin': 'https://cobalt.tools',
                'Referer': 'https://cobalt.tools/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 60000
        });

        if (response.data.status === 'error' || response.data.status === 'rate-limit') {
            throw new Error(response.data.text || 'فشل في التحميل: ' + (response.data.text || 'Unknown error'));
        }

        if (response.data.status === 'picker') {
            throw new Error('الرابط يحتوي على عدة وسائط، يرجى اختيار واحد (غير مدعوم حالياً)');
        }

        if (!response.data.url) {
            throw new Error('لم يتم الحصول على رابط التحميل');
        }

        // تنزيل الملف
        const downloadUrl = response.data.url;
        const extension = format === 'mp3' ? '.mp3' : '.mp4';
        const filename = `download_${Date.now()}${extension}`;
        const filepath = path.join(TEMP_DIR, filename);

        console.log(`[Cobalt] Downloading from: ${downloadUrl}`);

        const fileResponse = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream',
            timeout: 120000,
            maxContentLength: 100 * 1024 * 1024, // 100MB max
            maxBodyLength: 100 * 1024 * 1024
        });

        const writer = createWriteStream(filepath);
        await pipeline(fileResponse.data, writer);

        console.log(`[Cobalt] Downloaded to: ${filepath}`);
        return filepath;

    } catch (error) {
        if (error.response?.status === 400 || error.response?.status === 401 || error.response?.status === 403) {
            throw new Error(`تعذر التحميل (${error.response.status}). يرجى التحقق من إعدادات COBALT_API_URL.`);
        }
        if (error.response?.status === 429) {
            throw new Error('تم تجاوز حد الطلبات. حاول مجدداً بعد قليل');
        }
        throw new Error(error.response?.data?.text || error.message || 'فشل في التحميل');
    }
}

async function convertToMp3(videoPath) {
    return videoPath;
}

async function compressVideo(videoPath) {
    console.log('[Cobalt] Compression handled by quality selection');
    return videoPath;
}

function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        console.error('[Cobalt] Error getting file size:', error);
        return 0;
    }
}

function deleteFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[Cobalt] Deleted: ${filePath}`);
        }
    } catch (error) {
        console.error(`[Cobalt] Error deleting file:`, error);
    }
}

function cleanupTempDir() {
    try {
        const files = fs.readdirSync(TEMP_DIR);
        const now = Date.now();
        const maxAge = 60 * 60 * 1000; // 1 hour

        for (const file of files) {
            const filePath = path.join(TEMP_DIR, file);
            const stats = fs.statSync(filePath);

            if (now - stats.mtimeMs > maxAge) {
                deleteFile(filePath);
            }
        }
    } catch (error) {
        console.error('[Cobalt] Cleanup error:', error);
    }
}

setInterval(cleanupTempDir, 30 * 60 * 1000);

module.exports = {
    detectVideoUrls,
    getVideoInfo,
    downloadVideo,
    convertToMp3,
    compressVideo,
    getFileSize,
    deleteFile,
    getPlatformName,
    formatDuration,
    MAX_FILE_SIZE,
    TEMP_DIR
};
