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
const COBALT_API = 'https://api.cobalt.tools';

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
        const response = await axios.post(COBALT_API, {
            url: url,
            videoQuality: '720',
            audioFormat: 'mp3',
            filenameStyle: 'basic',
            downloadMode: 'auto',
            youtubeVideoCodec: 'h264',
            alwaysProxy: true
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        if (response.data.status === 'error' || response.data.status === 'rate-limit') {
            throw new Error(response.data.text || 'فشل في الحصول على معلومات الفيديو');
        }

        // Cobalt v10 structure mapping
        return {
            title: response.data.filename || 'video',
            thumbnail: null, // Cobalt v10 might not provide thumbnail in direct response
            duration: null,
            uploader: null,
            url: url
        };
    } catch (error) {
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
        // تحديد الإعدادات حسب الجودة والتنسيق
        const downloadMode = format === 'mp3' ? 'audio' : 'auto';
        let videoQuality = '720';

        if (quality === 'best') {
            videoQuality = 'max';
        } else if (quality === '720') {
            videoQuality = '720';
        } else if (quality === '480') {
            videoQuality = '480';
        }

        // طلب التحميل من Cobalt
        const response = await axios.post(COBALT_API, {
            url: url,
            videoQuality: videoQuality,
            audioFormat: 'mp3',
            filenameStyle: 'basic',
            downloadMode: downloadMode,
            youtubeVideoCodec: 'h264',
            alwaysProxy: true
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
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
        if (error.response?.status === 429) {
            throw new Error('تم تجاوز حد الطلبات. حاول مجدداً بعد قليل');
        }
        throw new Error(error.response?.data?.text || error.message || 'فشل في التحميل');
    }
}

/**
 * لا نحتاج convertToMp3 لأن Cobalt يدعم MP3 مباشرة
 */
async function convertToMp3(videoPath) {
    return videoPath;
}

/**
 * ضغط الفيديو (مبسط - نحاول تحميل بجودة أقل)
 */
async function compressVideo(videoPath) {
    console.log('[Cobalt] Compression handled by quality selection');
    return videoPath;
}

/**
 * الحصول على حجم الملف
 */
function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        console.error('[Cobalt] Error getting file size:', error);
        return 0;
    }
}

/**
 * حذف ملف
 */
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

/**
 * تنظيف المجلد المؤقت (حذف الملفات القديمة)
 */
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

// تنظيف دوري كل 30 دقيقة
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
    MAX_FILE_SIZE,
    TEMP_DIR
};
