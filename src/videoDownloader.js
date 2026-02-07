/**
 * Video Downloader Module - Using yt-dlp-exec
 * تحميل الفيديوهات من YouTube, TikTok, Instagram وأكثر من 1000 موقع
 * 
 * Same technology used by professional Telegram bots!
 */

const ytdlp = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');

// إعدادات
const TEMP_DIR = path.join(__dirname, '..', 'temp');
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB Discord limit

// أنماط الروابط المدعومة
const URL_PATTERNS = {
    youtube: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/gi,
    tiktok: /(?:https?:\/\/)?(?:www\.)?(?:vm\.)?tiktok\.com\/[@\w\/-]+/gi,
    instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|p)\/[\w-]+/gi,
    twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/\d+/gi,
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
        twitter: 'Twitter/X',
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
 * الحصول على معلومات الفيديو من yt-dlp
 */
async function getVideoInfo(url) {
    try {
        console.log(`[yt-dlp] Fetching info for: ${url}`);

        const info = await ytdlp(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            // Use Android client to bypass bot detection
            extractorArgs: 'youtube:player_client=android',
        });

        return {
            title: info.title || 'video',
            thumbnail: info.thumbnail || null,
            duration: info.duration || 0,
            author: info.uploader || info.channel || 'Unknown',
            url: url
        };
    } catch (error) {
        console.error(`[yt-dlp] Failed to get video info:`, error.message);

        // Return basic info if metadata fetch fails
        return {
            title: 'فيديو',
            thumbnail: null,
            duration: 0,
            author: 'غير معروف',
            url: url
        };
    }
}

/**
 * تحميل الفيديو باستخدام yt-dlp
 */
async function downloadVideo(url, format = 'mp4', quality = 'best') {
    try {
        const filename = `download_${Date.now()}`;
        const outputTemplate = path.join(TEMP_DIR, `${filename}.%(ext)s`);

        console.log(`[yt-dlp] Downloading: ${url} (${format}, ${quality})`);

        let options = {
            output: outputTemplate,
            noWarnings: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            // Use Android client to bypass YouTube bot detection
            extractorArgs: 'youtube:player_client=android',
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36'
            ],
        };

        // Audio-only mode
        if (format === 'mp3') {
            options.extractAudio = true;
            options.audioFormat = 'mp3';
            options.audioQuality = '192K';
        } else {
            // Video mode with quality selection
            if (quality === 'best') {
                options.format = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
            } else if (quality === '720') {
                options.format = `bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]`;
            } else if (quality === '480') {
                options.format = `bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]`;
            }

            // Merge to mp4
            options.mergeOutputFormat = 'mp4';
            options.remuxVideo = 'mp4';
        }

        await ytdlp(url, options);

        // Find the downloaded file
        const files = fs.readdirSync(TEMP_DIR);
        const downloadedFile = files.find(f => f.startsWith(filename));

        if (!downloadedFile) {
            throw new Error('لم يتم العثور على الملف المحمل');
        }

        const filepath = path.join(TEMP_DIR, downloadedFile);
        console.log(`[yt-dlp] Downloaded to: ${filepath}`);

        return filepath;

    } catch (error) {
        console.error(`[yt-dlp] Download failed:`, error.message);

        if (error.message.includes('Unsupported URL')) {
            throw new Error('الرابط غير مدعوم. جرب رابط من YouTube أو TikTok أو Instagram');
        }
        if (error.message.includes('Video unavailable')) {
            throw new Error('الفيديو غير متوفر أو محذوف');
        }
        if (error.message.includes('Private video')) {
            throw new Error('الفيديو خاص ولا يمكن تحميله');
        }

        throw new Error(error.message || 'فشل في التحميل');
    }
}

/**
 * الحصول على رابط تحميل مباشر (بدون تحميل الملف)
 * مفيد للملفات الكبيرة التي تتجاوز حد Discord
 */
async function getDirectDownloadUrl(url, format = 'mp4', quality = 'best') {
    try {
        console.log(`[yt-dlp] Getting direct download URL: ${url} (${format}, ${quality})`);

        let formatFilter;

        // Audio-only mode
        if (format === 'mp3') {
            formatFilter = 'bestaudio';
        } else {
            // Video mode with quality selection
            if (quality === 'best') {
                formatFilter = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
            } else if (quality === '720') {
                formatFilter = `bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]`;
            } else if (quality === '480') {
                formatFilter = `bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]`;
            }
        }

        const info = await ytdlp(url, {
            dumpSingleJson: true,
            format: formatFilter,
            noWarnings: true,
            noCheckCertificate: true,
            // Use Android client to bypass bot detection
            extractorArgs: 'youtube:player_client=android',
        });

        // Get the direct URL
        let directUrl = info.url;

        // If it's a combination of video+audio, get the video URL
        if (info.requested_formats && info.requested_formats.length > 0) {
            directUrl = info.requested_formats[0].url;
        }

        console.log(`[yt-dlp] Got direct URL (expires in ~6 hours)`);

        return {
            url: directUrl,
            title: info.title || 'video',
            filesize: info.filesize || info.filesize_approx || 0,
            ext: info.ext || (format === 'mp3' ? 'mp3' : 'mp4')
        };

    } catch (error) {
        console.error(`[yt-dlp] Failed to get direct URL:`, error.message);
        throw new Error('فشل في الحصول على رابط التحميل');
    }
}

/**
 * تحويل فيديو إلى MP3 (not needed with yt-dlp, keeping for compatibility)
 */
async function convertToMp3(videoPath) {
    // yt-dlp handles this automatically
    return videoPath;
}

/**
 * ضغط الفيديو (not needed with quality selection, keeping for compatibility)
 */
async function compressVideo(videoPath) {
    console.log('[yt-dlp] Compression handled by quality selection');
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
        console.error('[yt-dlp] Error getting file size:', error);
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
            console.log(`[yt-dlp] Deleted: ${filePath}`);
        }
    } catch (error) {
        console.error(`[yt-dlp] Error deleting file:`, error);
    }
}

/**
 * تنظيف مجلد temp من الملفات القديمة
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
        console.error('[yt-dlp] Cleanup error:', error);
    }
}

// Auto-cleanup every 30 minutes
setInterval(cleanupTempDir, 30 * 60 * 1000);

module.exports = {
    detectVideoUrls,
    getVideoInfo,
    downloadVideo,
    getDirectDownloadUrl,
    convertToMp3,
    compressVideo,
    getFileSize,
    deleteFile,
    getPlatformName,
    formatDuration,
    MAX_FILE_SIZE,
    TEMP_DIR
};
