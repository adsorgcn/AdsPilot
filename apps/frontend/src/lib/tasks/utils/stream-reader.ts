import type { TasksListApiResponse } from '../types';
import { parseSseEvent } from './task-helpers';

/**
 * 读取Tasks SSE流并处理数据
 */
export async function readTasksStream(
  response: Response,
  onMessage: (payload: TasksListApiResponse) => void,
): Promise<void> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('无法读取任务实时流');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const parsed = parseSseEvent(rawEvent);
      if (parsed?.data) {
        try {
          const payload = JSON.parse(parsed.data) as TasksListApiResponse;
          onMessage(payload);
        } catch (error) {
          console.error('[tasks] SSE 数据解析失败', error, parsed.data);
        }
      }

      boundary = buffer.indexOf('\n\n');
    }
  }
}
