import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { ChatMessage } from './types';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private base = '/api'; // ถ้าไม่ได้ใช้ proxy ให้เปลี่ยนเป็น 'http://localhost:11434'

  /**
   * เรียก Ollama /api/chat แบบสตรีมข้อความทีละชิ้น (chunked JSON)
   * @param model ชื่อโมเดล เช่น 'deepseek-coder-v2'
   * @param messages ประวัติการสนทนา
   * @returns Observable ที่ปล่อย token/ข้อความต่อเนื่อง
   */
  streamChat(model: string, messages: ChatMessage[]): Observable<string> {
    return new Observable<string>((subscriber) => {
      const controller = new AbortController();

      (async () => {
        try {
          const res = await fetch(`${this.base}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              // สามารถปรับ options เช่น temperature, top_p, max_tokens ได้
              messages,
              stream: true
            }),
            signal: controller.signal,
          });

          if (!res.ok || !res.body) {
            throw new Error(`HTTP ${res.status}`);
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // Ollama ส่งเป็นบรรทัดละ JSON (ndjson)
            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, newlineIndex).trim();
              buffer = buffer.slice(newlineIndex + 1);

              if (!line) continue;
              try {
                const json = JSON.parse(line);
                // โครงสร้าง: { message: { role, content }, done: boolean, ... }
                if (json?.message?.content) {
                  subscriber.next(json.message.content as string);
                }
                if (json?.done) {
                  subscriber.complete();
                }
              } catch {
                // ถ้า parse ไม่ได้ ข้ามบรรทัดนั้น
              }
            }
          }

          // เศษท้ายบัฟเฟอร์ (ถ้ามี)
          if (buffer.trim()) {
            try {
              const json = JSON.parse(buffer.trim());
              if (json?.message?.content) {
                subscriber.next(json.message.content as string);
              }
            } catch {}
          }

          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      })();

      // cleanup
      return () => controller.abort();
    });
  }
}
