'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './VoiceRecorder.module.css';

interface VoiceRecorderProps {
  onConversationEnd: () => void;
}

export default function VoiceRecorder({ onConversationEnd }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<'ready' | 'active' | 'error'>('ready');
  const [statusText, setStatusText] = useState('Ready');
  const [transcripts, setTranscripts] = useState<Array<{ text: string; isFinal: boolean }>>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  async function startRecording() {
    try {
      // Setup WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}`);
      wsRef.current = ws;

      ws.onopen = () => {
        updateStatus('Connected', 'active');
        setIsRecording(true);
        setTranscripts([{ text: 'Conversation started...', isFinal: true }]);

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
            addTranscript(text, isFinal);
          }
        } else if (data.type === 'session_started') {
          setCurrentConversationId(data.conversationId);
        } else if (data.type === 'error') {
          console.error('WebSocket error:', data.message);
          updateStatus('Error', 'error');
        }
      };

      ws.onerror = () => updateStatus('Error', 'error');
      ws.onclose = () => {
        if (isRecording) stopRecording();
      };
    } catch (error) {
      console.error('Failed to start recording:', error);
      updateStatus('Error', 'error');
    }
  }

  function stopRecording() {
    setIsRecording(false);
    updateStatus('Ready', 'ready');

    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'stop_session' }));
      setTimeout(() => wsRef.current?.close(), 500);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Trigger summary generation
    if (currentConversationId) {
      setTimeout(() => {
        fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: currentConversationId }),
        });
        onConversationEnd();
      }, 1000);
    }
  }

  async function startAudioCapture() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = audioContext;

      const input = audioContext.createMediaStreamSource(stream);

      // Setup analyser for visualizer
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      input.connect(analyser);
      visualize();

      // Setup processor for audio data
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      input.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        const base64Audio = arrayBufferToBase64(pcmData);
        wsRef.current.send(JSON.stringify({ audio_data: base64Audio }));
      };
    } catch (error) {
      console.error('Failed to capture audio:', error);
      updateStatus('Error', 'error');
    }
  }

  function visualize() {
    if (!isRecording) return;

    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function draw() {
      animationRef.current = requestAnimationFrame(draw);
      analyser!.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgba(22, 27, 34, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / dataArray.length) * 2.5;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = dataArray[i] / 2;
        const g = barHeight + 25 * (i / dataArray.length);
        ctx.fillStyle = `rgb(50, ${g + 100}, 255)`;
        ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight);
        x += barWidth + 1;
      }
    }

    draw();
  }

  function updateStatus(text: string, type: 'ready' | 'active' | 'error') {
    setStatusText(text);
    setStatus(type);
  }

  function addTranscript(text: string, isFinal: boolean) {
    setTranscripts((prev) => {
      const lastTranscript = prev[prev.length - 1];
      if (!isFinal && lastTranscript && !lastTranscript.isFinal) {
        // Update last transcript if it's not final
        return [...prev.slice(0, -1), { text, isFinal }];
      } else {
        // Add new transcript
        return [...prev, { text, isFinal }];
      }
    });
  }

  function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  useEffect(() => {
    // Resize canvas to fit container
    const canvas = canvasRef.current;
    if (canvas) {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
      }
    }
  }, []);

  return (
    <div className={styles.container}>
      <div className={`${styles.visualizerContainer} ${isRecording ? styles.recording : ''}`}>
        <div className={`${styles.statusPill} ${styles[status]}`}>
          <div className={styles.statusIndicator}></div>
          <span>{statusText}</span>
        </div>
        <canvas ref={canvasRef} className={styles.canvas}></canvas>
      </div>

      <div className={styles.transcriptContainer}>
        {transcripts.map((t, i) => (
          <div
            key={i}
            className={`${styles.message} ${t.isFinal ? styles.final : styles.interim}`}
          >
            {t.text}
          </div>
        ))}
      </div>

      <div className={styles.controls}>
        {!isRecording ? (
          <button className={styles.recordBtn} onClick={startRecording}>
            <span className={styles.recordIcon}>●</span>
            <span>Start Conversation</span>
          </button>
        ) : (
          <button className={styles.finishBtn} onClick={stopRecording}>
            <span>⏹</span> End
          </button>
        )}
      </div>
    </div>
  );
}

