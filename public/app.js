// --- State ---
const State = {
    isRecording: false,
    activeView: 'live', // 'live' or 'detail'
    currentConversationId: null,
    conversations: []
};

// --- DOM Elements ---
const views = {
    live: document.getElementById('view-live'),
    detail: document.getElementById('view-detail')
};
const historyList = document.getElementById('history-list');
const liveTranscript = document.getElementById('live-transcript');
const detailTranscript = document.getElementById('detail-transcript');
const btns = {
    record: document.getElementById('recordBtn'),
    finish: document.getElementById('finishBtn'),
    newConv: document.getElementById('new-conv-btn'),
    closeDetail: document.getElementById('close-detail-btn'),
    ask: document.getElementById('ask-btn')
};
const detailMeta = {
    title: document.getElementById('detail-title-text'),
    meta: document.getElementById('detail-meta-text'),
    points: document.getElementById('insight-points'),
    stats: document.getElementById('insight-stats')
};
const visualizerCanvas = document.getElementById('visualizer');
const container = document.getElementById('visualizer-container');
const statusText = document.getElementById('status-text');
const statusPill = document.getElementById('status-pill');

// --- Audio & WS ---
let ws;
let audioContext;
let processor;
let input;
let globalStream;
let analyser;
let dataArray;
let animationId;
let canvasCtx = visualizerCanvas.getContext('2d');

// --- Init ---
async function init() {
    await fetchHistory();
    // Default global stats (Mock)
    detailMeta.stats.innerHTML = `
        <li>Total Conversations: ${State.conversations.length}</li>
        <li>Active Topics: Hackathon, Design</li>
    `;

    // Resize Listener
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
}
init();

// --- Navigation ---
function switchView(viewName) {
    State.activeView = viewName;
    Object.values(views).forEach(el => el.classList.remove('active'));
    views[viewName].classList.add('active');
}

btns.newConv.onclick = () => {
    switchView('live');
    // Clear live transcript if starting fresh context logic needed
    // For now we keep it simple
};

btns.closeDetail.onclick = () => {
    switchView('live');
};

// --- History & Persistence ---
async function fetchHistory() {
    try {
        const res = await fetch('/api/conversations');
        const data = await res.json();
        State.conversations = data;
        renderHistory();
    } catch (e) {
        console.error("Failed to fetch history", e);
    }
}

function renderHistory() {
    historyList.innerHTML = '';
    State.conversations.forEach(conv => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-title">${conv.title}</div>
            <div class="history-meta">${new Date(conv.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        div.onclick = () => loadConversationDetail(conv.id);
        historyList.appendChild(div);
    });
}

async function loadConversationDetail(id) {
    try {
        const res = await fetch(`/api/conversations/${id}`);
        const conv = await res.json();

        switchView('detail');

        // Populate Meta
        detailMeta.title.textContent = conv.title;
        detailMeta.meta.textContent = new Date(conv.startTime).toLocaleString();

        // Populate Transcript
        detailTranscript.innerHTML = '';
        if (conv.transcripts && conv.transcripts.length) {
            conv.transcripts.forEach(t => {
                const row = document.createElement('div');
                row.className = `message transcript ${t.isFinal ? 'final' : ''}`;
                row.textContent = t.text;
                detailTranscript.appendChild(row);
            });
        } else {
            detailTranscript.innerHTML = '<div class="message info">No transcript available for this session.</div>';
        }

        // Populate Summary
        const summaryEl = document.getElementById('insight-summary');
        if (summaryEl) summaryEl.textContent = conv.summary || "No summary available.";

        // Populate Key Points
        detailMeta.points.innerHTML = '';
        if (conv.keyPoints && conv.keyPoints.length) {
            conv.keyPoints.forEach(p => {
                const li = document.createElement('li');
                li.textContent = p;
                detailMeta.points.appendChild(li);
            });
        } else {
            detailMeta.points.innerHTML = '<li>--</li>';
        }

        // Populate Action Items
        const actionsEl = document.getElementById('insight-actions');
        if (actionsEl) {
            actionsEl.innerHTML = '';
            if (conv.actionItems && conv.actionItems.length) {
                conv.actionItems.forEach(p => {
                    const li = document.createElement('li');
                    li.textContent = p;
                    actionsEl.appendChild(li);
                });
            } else {
                actionsEl.innerHTML = '<li>--</li>';
            }
        }

    } catch (e) {
        console.error("Failed to load detail", e);
    }
}


// --- Recording Logic ---
btns.record.onclick = async () => {
    if (!State.isRecording) startRecording();
};

btns.finish.onclick = async () => {
    if (State.isRecording) stopRecording();
};

async function startRecording() {
    try {
        // Setup WS
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = () => {
            updateStatus("Connected", "active");
            State.isRecording = true;
            btns.record.disabled = true;
            btns.record.style.display = 'none';
            btns.finish.disabled = false;
            btns.finish.style.display = 'flex';

            container.classList.add('recording');
            liveTranscript.innerHTML = '<div class="message info">Conversation started...</div>';

            // Send start session signal
            ws.send(JSON.stringify({ type: 'start_session' }));

            startAudioCapture();
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'transcript') {
                const isFinal = data.data.is_final;
                const text = data.data.text;
                if (text) {
                    addLiveMessage(text, isFinal);
                }
            } else if (data.type === 'session_started') {
                State.currentConversationId = data.conversationId;
            }
        };

        ws.onerror = () => updateStatus("Error", "error");
        ws.onclose = () => {
            if (State.isRecording) stopRecording();
        };

    } catch (e) {
        console.error(e);
        updateStatus("Error", "error");
    }
}

function stopRecording() {
    State.isRecording = false;
    btns.record.disabled = false;
    btns.record.style.display = 'flex';
    btns.finish.disabled = true;
    btns.finish.style.display = 'none';
    container.classList.remove('recording');
    updateStatus("Ready", "ready");

    if (ws) {
        ws.send(JSON.stringify({ type: 'stop_session' }));
        setTimeout(() => ws.close(), 500);
    }

    if (globalStream) globalStream.getTracks().forEach(t => t.stop());
    if (audioContext) audioContext.close();
    cancelAnimationFrame(animationId);
    canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

    // Refresh history to show new convo
    setTimeout(() => {
        fetchHistory();
        // Trigger summary generation for the just ended convo
        if (State.currentConversationId) {
            fetch('/api/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: State.currentConversationId })
            }); // Fire and forget update
        }
    }, 1000);
}

// --- Live Audio ---
async function startAudioCapture() {
    globalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    input = audioContext.createMediaStreamSource(globalStream);

    // Visualizer
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    input.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    visualize();

    // Processor
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    input.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        const base64Audio = arrayBufferToBase64(pcmData);
        ws.send(JSON.stringify({ audio_data: base64Audio }));
    };
}

// --- Helpers ---
function updateStatus(text, type) {
    statusText.textContent = text;
    statusPill.className = '';
    if (type === 'active') statusPill.classList.add('status-active');
    if (type === 'error') statusPill.classList.add('status-error');
}

function resizeCanvas() {
    visualizerCanvas.width = container.offsetWidth;
    visualizerCanvas.height = container.offsetHeight;
}

function addLiveMessage(text, isFinal) {
    const lastMsg = liveTranscript.lastElementChild;
    const isLastTemp = lastMsg && lastMsg.classList.contains('transcript') && !lastMsg.classList.contains('final');

    if (!isFinal && isLastTemp) {
        lastMsg.textContent = text;
    } else {
        const div = document.createElement('div');
        div.className = `message transcript ${isFinal ? 'final' : ''}`;
        div.textContent = text;
        liveTranscript.appendChild(div);
    }
    liveTranscript.scrollTop = liveTranscript.scrollHeight;
}

function floatTo16BitPCM(output, offset = 0) {
    const buffer = new ArrayBuffer(output.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < output.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, output[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function visualize() {
    if (!State.isRecording) return;
    animationId = requestAnimationFrame(visualize);
    analyser.getByteFrequencyData(dataArray);
    canvasCtx.fillStyle = 'rgba(22, 27, 34, 0.2)';
    canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

    const barWidth = (visualizerCanvas.width / dataArray.length) * 2.5;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
        let barHeight = dataArray[i] / 2;
        const g = barHeight + 25 * (i / dataArray.length);
        canvasCtx.fillStyle = `rgb(50, ${g + 100}, 255)`;
        canvasCtx.fillRect(x, (visualizerCanvas.height - barHeight) / 2, barWidth, barHeight);
        x += barWidth + 1;
    }
}
