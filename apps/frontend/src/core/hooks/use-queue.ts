import { useCallback } from 'react';

interface Task<Data = unknown> {
  data?: Data;
  action: () => Promise<unknown>;
  resolve: <T extends Data>(value: T | PromiseLike<T>) => void;
  reject: (value: unknown) => void;
}

interface QueueItem {
  tasks: Task[];
  pending: boolean;
}

interface QueueParams {
  delayTime: number;
}

const state = new Map<string, QueueItem>();
const callbacks = new Map<string, (item: QueueItem, task: Task) => void>();

/**
 * @name useQueue
 * @description Simple Queue to execute promises sequentially
 *
 * For example, we can create a queue that writes quickly to a document with ID
 * /doc/1, but we want to execute the writes sequentially to avoid
 * race-conditions
 *
 * Usage:
 *
 * const queue = useQueue();
 * const [isWriting, setIsWriting] = useState();
 *
 * const docId = '/doc/1';
 *
 * queue.subscribe(docId, ({ pending }) => {
 *   setIsWriting(pending);
 * });
 *
 * queue.enqueue(
 *  docId,
 *  addDoc(doc(docId, data))
 * );
 *
 * queue.enqueue(
 *  docId,
 *  updateDoc(doc(docId, data))
 * );
 *
 * queue.clear(docId);
 */
function useQueue(params?: Partial<QueueParams>) {
  const delayTime = params?.delayTime;

  const subscribe = (
    key: string,
    callback: (item: QueueItem, task: Task) => void
  ) => {
    callbacks.set(key, callback);
  };

  const dequeue = useCallback(
    async (key: string) => {
      const item = state.get(key);

      if (!item || item.pending) {
        return;
      }

      const nextTask = item.tasks.shift();

      if (!nextTask) {
        return;
      }

      const next = (task?: Task) => {
        item.pending = false;

        const callback = callbacks.get(key);

        if (callback && task) {
          callback(item, task);
        }

        if (delayTime) {
          setTimeout(() => dequeue(key), delayTime);
        } else {
          dequeue(key);
        }
      };

      try {
        item.pending = true;

        const callback = callbacks.get(key);

        if (callback) {
          callback(item, nextTask);
        }

        const value = await nextTask.action();

        nextTask.data = value;
        nextTask.resolve(value);

        next(nextTask);
      } catch (e) {
        nextTask.reject(e);
        next();
      }
    },
    [delayTime]
  );

  const enqueue = useCallback(
    <T>(key: string, action: () => Promise<T>) => {
      return new Promise<T>((resolve, reject) => {
        let item = state.get(key);

        if (!item) {
          item = {
            pending: false,
            tasks: [],
          };

          state.set(key, item);
        }

        const task: Task<T> = {
          action,
          resolve,
          reject,
        };

        item.tasks.push(task);

        return dequeue(key);
      });
    },
    [dequeue]
  );

  const clear = useCallback((key?: string) => {
    if (key) {
      state.delete(key);
      callbacks.delete(key);
    } else {
      state.clear();
      callbacks.clear();
    }
  }, []);

  return {
    enqueue,
    clear,
    subscribe,
  };
}

export default useQueue;
