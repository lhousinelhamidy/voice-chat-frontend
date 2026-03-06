/**
 * WebRTC Handler - Lightweight P2P Voice Connection
 * Optimized for low bandwidth and CPU usage
 */

class VoiceChat {
    constructor() {
        this.socket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.roomId = null;
        this.peerId = null;
        this.isMicMuted = false;
        
        // WebRTC Configuration with STUN servers
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };
        
        // Audio constraints optimized for low bandwidth
        this.audioConstraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                // تقليل جودة الصوت لتوفير البيانات
                sampleRate: 16000,
                channelCount: 1
            },
            video: false
        };
    }

    /**
     * تهيئة الاتصال بالسيرفر
     */
    init(serverUrl, roomId, password = null) {
        this.roomId = roomId;
        
        // الاتصال بـ Socket.IO
        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        this.setupSocketListeners();
        
        // الانضمام للروم
        this.socket.emit('join-room', { roomId, password });
    }

    /**
     * إعداد مستمعات الأحداث
     */
    setupSocketListeners() {
        // نجاح الانضمام
        this.socket.on('room-joined', async (data) => {
            console.log('Joined room:', data);
            this.updateStatus('connected', 'متصل بالروم');
            
            // بدء الميكروفون
            await this.startLocalStream();
        });

        // خطأ في الانضمام
        this.socket.on('room-error', (data) => {
            console.error('Room error:', data);
            alert(data.message);
            window.location.href = 'index.html';
        });

        // انضمام مستخدم آخر
        this.socket.on('peer-joined', async (data) => {
            console.log('Peer joined:', data.peerId);
            this.peerId = data.peerId;
            this.updatePeerStatus('👤 متصل');
            
            // إنشاء اتصال WebRTC
            await this.createPeerConnection();
            
            // إنشاء وإرسال offer
            await this.createOffer();
        });

        // استقبال إشارات WebRTC
        this.socket.on('webrtc-signal', async (data) => {
            console.log('Received signal from:', data.from);
            await this.handleSignal(data);
        });

        // مغادرة المستخدم الآخر
        this.socket.on('peer-left', () => {
            console.log('Peer left');
            this.updateStatus('waiting', 'في انتظار شخص آخر...');
            this.updatePeerStatus('❓ في انتظار...');
            this.closePeerConnection();
        });

        // قطع الاتصال
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateStatus('disconnected', 'انقطع الاتصال');
        });
    }

    /**
     * بدء البث الصوتي المحلي
     */
    async startLocalStream() {
        try {
            // محاولة 1: إعدادات متقدمة
            console.log('Attempting advanced audio constraints...');
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 16000,
                        channelCount: 1
                    },
                    video: false
                });
                console.log('✅ Advanced constraints successful');
            } catch (advError) {
                console.warn('⚠️ Advanced constraints failed, trying basic...', advError.message);
                
                // محاولة 2: إعدادات أساسية
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false
                });
                console.log('✅ Basic constraints successful');
            }
            
            console.log('Local stream started:', this.localStream.id);
            
            // تفعيل زر الميكروفون
            const micBtn = document.getElementById('mic-btn');
            if (micBtn) micBtn.disabled = false;
            
            // تفعيل مؤشر الصوت
            this.startAudioVisualization('local-indicator', this.localStream);
            
            this.updateStatus('ready', 'جاهز - في انتظار شخص آخر');
            
        } catch (error) {
            console.error('❌ Error accessing microphone:', error.name, error.message);
            
            // رسالة خطأ مفصلة
            let errorMsg = 'لم نتمكن من الوصول للميكروفون.\n\n';
            
            switch(error.name) {
                case 'NotAllowedError':
                case 'PermissionDeniedError':
                    errorMsg += 'السبب: لم تمنح الإذن للميكروفون.\n\n';
                    errorMsg += 'الحل:\n';
                    errorMsg += '1. اضغط على أيقونة القفل 🔒 في شريط العنوان\n';
                    errorMsg += '2. اختر "Microphone" → Allow\n';
                    errorMsg += '3. حدّث الصفحة';
                    break;
                    
                case 'NotFoundError':
                    errorMsg += 'السبب: لم يتم العثور على ميكروفون.\n\n';
                    errorMsg += 'الحل:\n';
                    errorMsg += '1. تأكد من توصيل ميكروفون\n';
                    errorMsg += '2. تحقق من إعدادات النظام';
                    break;
                    
                case 'NotReadableError':
                    errorMsg += 'السبب: الميكروفون مستخدم من تطبيق آخر.\n\n';
                    errorMsg += 'الحل:\n';
                    errorMsg += '1. أغلق Zoom/Skype/Teams\n';
                    errorMsg += '2. أعد تشغيل المتصفح';
                    break;
                    
                default:
                    errorMsg += `خطأ: ${error.name}\n${error.message}\n\n`;
                    errorMsg += 'جرب متصفح آخر (Chrome مفضل)';
            }
            
            alert(errorMsg);
            
            // إعادة توجيه لصفحة الاختبار
            if (confirm('هل تريد الذهاب لصفحة اختبار الميكروفون؟')) {
                window.location.href = 'mic-test.html';
            }
        }
    }

    /**
     * إنشاء اتصال WebRTC
     */
    async createPeerConnection() {
        try {
            this.peerConnection = new RTCPeerConnection(this.rtcConfig);
            
            // إضافة البث المحلي
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // استقبال البث البعيد
            this.peerConnection.ontrack = (event) => {
                console.log('Received remote stream');
                const remoteAudio = document.getElementById('remote-audio');
                if (remoteAudio) {
                    remoteAudio.srcObject = event.streams[0];
                }
                
                // تفعيل مؤشر صوت الطرف الآخر
                this.startAudioVisualization('remote-indicator', event.streams[0]);
                
                this.updateStatus('connected', '🔊 متصل - يمكنك التحدث الآن');
                document.getElementById('connection-line')?.classList.add('active');
            };

            // معالجة ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('webrtc-signal', {
                        target: this.peerId,
                        signal: {
                            type: 'ice-candidate',
                            candidate: event.candidate
                        }
                    });
                }
            };

            // مراقبة حالة الاتصال
            this.peerConnection.onconnectionstatechange = () => {
                console.log('Connection state:', this.peerConnection.connectionState);
                
                if (this.peerConnection.connectionState === 'connected') {
                    this.updateStatus('connected', '🔊 متصل');
                    this.showConnectionQuality();
                } else if (this.peerConnection.connectionState === 'disconnected') {
                    this.updateStatus('disconnected', 'انقطع الاتصال');
                } else if (this.peerConnection.connectionState === 'failed') {
                    this.updateStatus('error', 'فشل الاتصال');
                    // إعادة المحاولة
                    this.createPeerConnection();
                }
            };

        } catch (error) {
            console.error('Error creating peer connection:', error);
        }
    }

    /**
     * إنشاء offer
     */
    async createOffer() {
        try {
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false
            });
            
            await this.peerConnection.setLocalDescription(offer);
            
            this.socket.emit('webrtc-signal', {
                target: this.peerId,
                signal: {
                    type: 'offer',
                    sdp: offer
                }
            });
            
            console.log('Offer sent');
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    /**
     * معالجة الإشارات الواردة
     */
    async handleSignal(data) {
        try {
            const { signal } = data;
            
            if (signal.type === 'offer') {
                // إنشاء اتصال إذا لم يكن موجوداً
                if (!this.peerConnection) {
                    await this.createPeerConnection();
                }
                
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                
                // إنشاء answer
                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);
                
                this.socket.emit('webrtc-signal', {
                    target: data.from,
                    signal: {
                        type: 'answer',
                        sdp: answer
                    }
                });
                
                console.log('Answer sent');
                
            } else if (signal.type === 'answer') {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                console.log('Answer received');
                
            } else if (signal.type === 'ice-candidate') {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
                console.log('ICE candidate added');
            }
        } catch (error) {
            console.error('Error handling signal:', error);
        }
    }

    /**
     * تبديل حالة الميكروفون
     */
    toggleMic() {
        if (!this.localStream) return;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            this.isMicMuted = !audioTrack.enabled;
            
            // تحديث UI
            const micBtn = document.getElementById('mic-btn');
            const micIcon = document.getElementById('mic-icon');
            const micText = document.getElementById('mic-text');
            
            if (this.isMicMuted) {
                micBtn.classList.add('muted');
                micIcon.textContent = '🔇';
                micText.textContent = 'الميكروفون مغلق';
            } else {
                micBtn.classList.remove('muted');
                micIcon.textContent = '🎤';
                micText.textContent = 'الميكروفون';
            }
        }
    }

    /**
     * مراقبة الصوت بصرياً
     */
    startAudioVisualization(elementId, stream) {
        const indicator = document.getElementById(elementId);
        if (!indicator) return;
        
        indicator.style.display = 'flex';
        
        // استخدام Web Audio API
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        
        analyser.fftSize = 256;
        microphone.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const checkAudio = () => {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            
            // تفعيل الأنيميشن عند التحدث
            if (average > 20) {
                indicator.parentElement.querySelector('.avatar')?.classList.add('active');
            } else {
                indicator.parentElement.querySelector('.avatar')?.classList.remove('active');
            }
            
            requestAnimationFrame(checkAudio);
        };
        
        checkAudio();
    }

    /**
     * عرض جودة الاتصال
     */
    async showConnectionQuality() {
        const qualityElement = document.getElementById('connection-quality');
        if (!qualityElement || !this.peerConnection) return;
        
        qualityElement.style.display = 'block';
        
        setInterval(async () => {
            const stats = await this.peerConnection.getStats();
            let quality = 'جيد';
            
            stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                    const packetsLost = report.packetsLost || 0;
                    const packetsReceived = report.packetsReceived || 0;
                    const lossRate = packetsLost / (packetsLost + packetsReceived);
                    
                    if (lossRate > 0.05) quality = 'ضعيف';
                    else if (lossRate > 0.02) quality = 'متوسط';
                }
            });
            
            document.getElementById('quality-indicator').textContent = quality;
        }, 5000);
    }

    /**
     * تحديث حالة الاتصال
     */
    updateStatus(status, text) {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.getElementById('status-text');
        
        if (statusDot) {
            statusDot.className = 'status-dot ' + status;
        }
        if (statusText) {
            statusText.textContent = text;
        }
    }

    /**
     * تحديث حالة المستخدم الآخر
     */
    updatePeerStatus(text) {
        const peerStatus = document.getElementById('peer-status');
        if (peerStatus) {
            peerStatus.textContent = text;
        }
        
        const remoteAvatar = document.getElementById('remote-avatar');
        if (remoteAvatar && text.includes('متصل')) {
            remoteAvatar.querySelector('.avatar-icon').textContent = '👤';
        }
    }

    /**
     * مغادرة الروم
     */
    leave() {
        // إيقاف البث المحلي
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        // إغلاق اتصال WebRTC
        this.closePeerConnection();
        
        // إغلاق Socket
        if (this.socket) {
            this.socket.emit('leave-room');
            this.socket.disconnect();
        }
        
        // العودة للصفحة الرئيسية
        window.location.href = 'index.html';
    }

    /**
     * إغلاق اتصال WebRTC
     */
    closePeerConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        const remoteAudio = document.getElementById('remote-audio');
        if (remoteAudio) {
            remoteAudio.srcObject = null;
        }
        
        document.getElementById('connection-line')?.classList.remove('active');
    }
}

// تصدير الكلاس
window.VoiceChat = VoiceChat;
