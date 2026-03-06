/**
 * Main Application Logic
 * Handles room creation, joining, and UI interactions
 */

// إعدادات السيرفر
const SERVER_URL = 'http://localhost:3000'; // غير هذا للإنتاج

// متغير عام للـ VoiceChat
let voiceChat = null;

/**
 * تبديل التبويبات
 */
function showTab(tabName) {
    // إخفاء كل التبويبات
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // إظهار التبويب المحدد
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.classList.add('active');
}

/**
 * إنشاء روم جديد
 */
function createRoom() {
    const password = document.getElementById('create-password').value.trim();
    
    // إنشاء رقم روم عشوائي (6 أرقام)
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // حفظ البيانات في localStorage
    localStorage.setItem('roomId', roomId);
    if (password) {
        localStorage.setItem('roomPassword', password);
    } else {
        localStorage.removeItem('roomPassword');
    }
    
    // الانتقال لصفحة الروم
    window.location.href = `room.html?room=${roomId}`;
}

/**
 * الانضمام لروم موجود
 */
function joinRoom() {
    const roomId = document.getElementById('join-room-id').value.trim().toUpperCase();
    const password = document.getElementById('join-password').value.trim();
    
    if (!roomId) {
        alert('الرجاء إدخال رقم الروم');
        return;
    }
    
    // حفظ البيانات
    localStorage.setItem('roomId', roomId);
    if (password) {
        localStorage.setItem('roomPassword', password);
    } else {
        localStorage.removeItem('roomPassword');
    }
    
    // الانتقال لصفحة الروم
    window.location.href = `room.html?room=${roomId}`;
}

/**
 * تهيئة صفحة الروم
 */
function initRoom() {
    // الحصول على رقم الروم من URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room') || localStorage.getItem('roomId');
    
    if (!roomId) {
        alert('رقم الروم غير صحيح');
        window.location.href = 'index.html';
        return;
    }
    
    // عرض رقم الروم
    const roomIdDisplay = document.getElementById('room-id-display');
    if (roomIdDisplay) {
        roomIdDisplay.textContent = roomId;
    }
    
    // الحصول على كلمة السر
    const password = localStorage.getItem('roomPassword') || null;
    
    // إنشاء اتصال Voice Chat
    voiceChat = new VoiceChat();
    voiceChat.init(SERVER_URL, roomId, password);
    
    // تنظيف عند مغادرة الصفحة
    window.addEventListener('beforeunload', () => {
        if (voiceChat) {
            voiceChat.leave();
        }
    });
}

/**
 * تبديل حالة الميكروفون
 */
function toggleMic() {
    if (voiceChat) {
        voiceChat.toggleMic();
    }
}

/**
 * مغادرة الروم
 */
function leaveRoom() {
    if (confirm('هل أنت متأكد من المغادرة؟')) {
        if (voiceChat) {
            voiceChat.leave();
        }
    }
}

/**
 * نسخ رقم الروم
 */
function copyRoomId() {
    const roomId = document.getElementById('room-id-display').textContent;
    
    // نسخ للحافظة
    navigator.clipboard.writeText(roomId).then(() => {
        // تغيير نص الزر مؤقتاً
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✅ تم النسخ';
        
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('فشل النسخ. الرجاء نسخ الرقم يدوياً: ' + roomId);
    });
}

/**
 * اكتشاف H+ وتفعيل وضع توفير البيانات
 */
function detectConnectionSpeed() {
    if ('connection' in navigator) {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (connection) {
            const type = connection.effectiveType;
            console.log('Connection type:', type);
            
            // إذا كان الاتصال بطيئاً (2G, slow-2g, 3g)
            if (type === '2g' || type === 'slow-2g' || type === '3g') {
                console.log('Low bandwidth detected - optimizing...');
                // يمكنك تقليل جودة الصوت أكثر هنا
                showLowBandwidthNotification();
            }
        }
    }
}

/**
 * إشعار بانخفاض سرعة الإنترنت
 */
function showLowBandwidthNotification() {
    const infoBox = document.querySelector('.info-box');
    if (infoBox) {
        const notice = document.createElement('p');
        notice.style.color = '#ffa500';
        notice.innerHTML = '⚠️ <strong>تنبيه:</strong> سرعة الإنترنت منخفضة - تم تحسين الجودة';
        infoBox.insertBefore(notice, infoBox.firstChild);
    }
}

/**
 * معالجة الأخطاء العامة
 */
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

/**
 * اكتشاف نوع الاتصال عند تحميل الصفحة
 */
if (window.location.pathname.includes('room.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        detectConnectionSpeed();
    });
}

// معالجة الضغط على Enter في حقول الإدخال
document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                // البحث عن الزر في نفس الحاوية
                const button = input.closest('.tab-content').querySelector('.btn-primary');
                if (button) {
                    button.click();
                }
            }
        });
    });
});

/**
 * منع النوم/التعليق على الموبايل
 */
function preventSleep() {
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(wakeLock => {
            console.log('Wake lock activated');
            
            // إعادة التفعيل عند العودة للصفحة
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    navigator.wakeLock.request('screen');
                }
            });
        }).catch(err => {
            console.log('Wake lock error:', err);
        });
    }
}

// تفعيل منع النوم في صفحة الروم
if (window.location.pathname.includes('room.html')) {
    window.addEventListener('load', preventSleep);
}
