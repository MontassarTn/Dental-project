import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * Voice dictation: streams the microphone to the speech service, shows the live transcript
 * and reads each confirmation aloud ("Done. Tooth 11: marked as missing.").
 * The transcript is the patient's dictation memory, kept by the speech service across recordings,
 * so a sentence can be finished later ("Tooth 12 and 13" ... "are missing").
 */
@Component({
  standalone: true,
  selector: 'app-voice-dictation',
  imports: [],
  template: `
    <div class="transcriber-controls">
      <button type="button" (click)="toggleRecording()" class="btn-record" [class.recording]="isRecording">
        @if (isRecording) { <span class="rec-dot"></span> } @else { <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg> }
        {{ isRecording ? 'Stop Voice Command' : 'Start Voice Command' }}
      </button>
    </div>

    @if (isRecording || entries.length) {
      <section class="transcript" aria-live="polite">
        <header class="transcript-head">
          <span class="transcript-title">
            @if (isRecording) { <span class="live-dot"></span> Listening } @else { Transcript }
          </span>
          @if (entries.length && !isRecording) {
            <button type="button" class="link-btn" (click)="clearTranscript()"
                    title="Clear the transcript and what the assistant remembers">Clear</button>
          }
        </header>
        <ol class="transcript-list" #transcriptList>
          @for (entry of entries; track $index) {
            <li class="entry">
              <p class="said">{{ entry.text }}</p>
              @if (entry.pending) {
                <p class="reply pending">Updating chart…</p>
              } @else if (entry.reply) {
                <p class="reply"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg> {{ entry.reply }}</p>
              } @else {
                <p class="reply muted">No chart change</p>
              }
            </li>
          }
          @if (liveText) {
            <li class="entry live"><p class="said">{{ liveText }}</p></li>
          } @else if (isRecording && !entries.length) {
            <li class="hint">
              Try: "Tooth 11 is missing" or "Tooth 16, probing depth 3, 2, 4"
            </li>
          }
        </ol>
      </section>
    }
  `,
  styleUrls: ['./voice-dictation.component.scss']
})
export class VoiceDictationComponent implements OnChanges, OnDestroy {
  /** Patient whose chart the dictation updates. */
  @Input({ required: true }) patientId!: string;

  isRecording = false;

  /** What was said for this patient, and the assistant's spoken reply to each sentence. */
  entries: { text: string; reply?: string; pending: boolean }[] = [];
  /** Words of the sentence currently being spoken (not final yet). */
  liveText = '';

  @ViewChild('transcriptList') private transcriptList?: ElementRef<HTMLOListElement>;
  private muteMicUntil = 0;

  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private socket: WebSocket | null = null;
  private readonly sampleRate = 16000;
  private readonly speechUrl = environment.speechServiceUrl;
  private readonly http = inject(HttpClient);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId'] && this.patientId) {
      this.loadMemory();
    }
  }

  /** Show what the assistant already remembers for this patient (e.g. after a page reload). */
  private loadMemory() {
    this.http
      .get<{ turns: { said: string; reply: string }[] }>(`${this.speechUrl}/memory/${encodeURIComponent(this.patientId)}`)
      .subscribe({
        next: ({ turns }) => {
          this.entries = turns.map(t => ({ text: t.said, reply: t.reply, pending: false }));
          setTimeout(() => this.scrollTranscriptToEnd());
        },
        error: () => (this.entries = []), // speech service not running: start with an empty transcript
      });
  }

  async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async startRecording() {
    try {
      const socketUrl = this.speechUrl.replace(/^http/, 'ws');
      const params = new URLSearchParams({ segment: this.patientId });
      this.socket = new WebSocket(`${socketUrl}/transcribe?${params}`);
      this.socket.onerror = err => console.error('Speech service connection error:', err);
      this.socket.onmessage = (event) => this.handleMessage(JSON.parse(event.data));

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: 'default',
          sampleRate: this.sampleRate,
          sampleSize: 16,
          channelCount: 1
        },
        video: false
      });

      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      await this.audioContext.audioWorklet.addModule('assets/worklets/pcm-worker.js');

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-worker', {
        outputChannelCount: [1]
      });

      this.workletNode.port.onmessage = (event) => {
        const pcmChunk: Int16Array = event.data;
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          // Send silence while the assistant is talking, so it doesn't transcribe its own voice
          this.socket.send(this.isAssistantSpeaking() ? new Int16Array(pcmChunk.length).buffer : pcmChunk.buffer);
        }
      };

      source.connect(this.workletNode).connect(this.audioContext.destination);
      this.isRecording = true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.stopRecording();
    }
  }

  stopRecording() {
    this.mediaStream?.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
    this.socket?.close();
    this.mediaStream = null;
    this.audioContext = null;
    this.socket = null;
    this.workletNode = null;
    this.isRecording = false;
    // The dictation memory is kept, so the next recording can finish an incomplete sentence
  }

  clearTranscript() {
    this.entries = [];
    this.http.delete(`${this.speechUrl}/memory/${encodeURIComponent(this.patientId)}`).subscribe({
      error: error => console.error('Could not clear the dictation memory:', error),
    });
  }

  private handleMessage(data: { type: string; text: string; final?: boolean; speak?: boolean }) {
    if (data.type === 'transcript') {
      if (!data.final) {
        this.liveText = data.text;
      } else if (data.text.trim()) {
        this.liveText = '';
        this.entries.push({ text: data.text, pending: true });
      }
    } else if (data.type === 'reply') {
      // Replies arrive in the same order as the sentences they answer
      const entry = this.entries.find(e => e.pending);
      if (entry) {
        entry.pending = false;
        entry.reply = data.text;
      }
      if (data.speak && data.text) {
        this.speak(data.text);
      }
    }
    setTimeout(() => this.scrollTranscriptToEnd());
  }

  private speak(text: string) {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang === 'en-US') ?? voices.find(v => v.lang.startsWith('en'));
    if (voice) utterance.voice = voice;
    utterance.onend = utterance.onerror = () => (this.muteMicUntil = Date.now() + 400);
    speechSynthesis.speak(utterance);
  }

  private isAssistantSpeaking(): boolean {
    return ('speechSynthesis' in window && speechSynthesis.speaking) || Date.now() < this.muteMicUntil;
  }

  private scrollTranscriptToEnd() {
    const list = this.transcriptList?.nativeElement;
    if (list) list.scrollTop = list.scrollHeight;
  }

  ngOnDestroy(): void {
    this.stopRecording();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
}
