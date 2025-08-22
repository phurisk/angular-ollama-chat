import { Component, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from './chat.service';
import type { ChatMessage } from './types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'Angular + Ollama Chat';
  model = signal<string>('deepseek-coder-v2');

  messages = signal<ChatMessage[]>([
    { role: 'system', content: 'You are a helpful coding assistant.' }
  ]);

  input = signal<string>('');
  loading = signal<boolean>(false);

  // รวมข้อความเป็น string สำหรับแสดงข้อความ assistant ล่าสุดขณะสตรีม
  streamingBuffer = signal<string>('');

  // สร้างรายการสำหรับ render: รวม messages + buffer สตรีมล่าสุด (ถ้ามี)
  viewMessages = computed(() => {
    const arr: ChatMessage[] = [...this.messages()];
    if (this.loading() && this.streamingBuffer()) {
      arr.push({ role: 'assistant', content: this.streamingBuffer() });
    }
    return arr;
  });

  constructor(private chat: ChatService, private sanitizer: DomSanitizer) {}

  @ViewChild('chatWin', { static: false }) chatWin?: ElementRef<HTMLDivElement>;
  @ViewChild('composer', { static: false }) composer?: ElementRef<HTMLTextAreaElement>;

  private scrollToBottom() {
    const el = this.chatWin?.nativeElement;
    if (!el) return;
    // Use rAF for smoothness after DOM updates
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }

  // Very light formatter: escape HTML, convert fenced code and inline code to styled HTML
  renderMessage(text: string): SafeHtml {
    // Escape HTML
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Fenced code blocks ```lang\n...\n```
    escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) => {
      const language = lang ? String(lang) : 'plaintext';
      return `
        <div class="codeblock">
          <div class="codeblock-head">
            <span class="lang">${language}</span>
            <button class="copy" data-role="copy">Copy</button>
          </div>
          <pre><code class="language-${language}">${code.replace(/\n$/,'')}</code></pre>
        </div>
      `;
    });

    // Inline code `code`
    escaped = escaped.replace(/`([^`]+)`/g, (_m, c) => `<code class="inline">${c}</code>`);

    // Paragraph breaks
    escaped = escaped.replace(/\n\n+/g, '<br/><br/>').replace(/\n/g, '<br/>');

    return this.sanitizer.bypassSecurityTrustHtml(escaped);
  }

  // Delegate clicks inside chat window to support copy buttons inside sanitized HTML
  onMessageClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    if (target.matches('button.copy') || target.getAttribute('data-role') === 'copy') {
      const block = target.closest('.codeblock');
      const codeEl = block?.querySelector('pre > code') as HTMLElement | null;
      const text = codeEl?.innerText ?? '';
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        const prev = target.textContent;
        target.textContent = 'Copied';
        target.classList.add('copied');
        setTimeout(() => {
          target.textContent = prev || 'Copy';
          target.classList.remove('copied');
        }, 1200);
      });
    }
  }

  onKeydown(ev: KeyboardEvent) {
    // Send on Enter, allow newline with Shift+Enter
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      this.send();
      this.composer?.nativeElement.focus();
    }
  }

  async send() {
    const text = this.input().trim();
    if (!text || this.loading()) return;

    // เพิ่มข้อความ user ลงประวัติ
    const context = [...this.messages(), { role: 'user', content: text } as ChatMessage];
    this.messages.set(context);
    this.input.set('');
    this.streamingBuffer.set('');
    this.loading.set(true);
    this.scrollToBottom();

    // เรียก stream
    const sub = this.chat.streamChat(this.model(), context).subscribe({
      next: chunk => {
        // ต่อข้อความของ assistant ทีละชิ้น
        this.streamingBuffer.set(this.streamingBuffer() + chunk);
        this.scrollToBottom();
      },
      error: err => {
        console.error(err);
        this.loading.set(false);
      },
      complete: () => {
        // เมื่อจบสตรีม ย้าย buffer ไปเป็นข้อความ assistant ถาวร
        const finalAssistant: ChatMessage = { role: 'assistant', content: this.streamingBuffer() };
        this.messages.set([...this.messages(), finalAssistant]);
        this.streamingBuffer.set('');
        this.loading.set(false);
        this.scrollToBottom();
        this.composer?.nativeElement.focus();
      }
    });
  }

  clear() {
    this.messages.set([{ role: 'system', content: 'You are a helpful coding assistant.' }]);
    this.streamingBuffer.set('');
    this.composer?.nativeElement.focus();
  }

  formatRole(role: string): string {
    if (role === 'user') return 'You';
    if (role === 'assistant') return 'Assistant';
    return role;
  }
}
