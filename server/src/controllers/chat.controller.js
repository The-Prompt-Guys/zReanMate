import { chatService } from '../services/chat.service.js';

const writeFrame = (res, frame) => {
  res.write(`id: ${frame.id}\n`);
  res.write(`event: ${frame.event}\n`);
  res.write(`data: ${JSON.stringify(frame.data)}\n\n`);
  if (frame.event === 'done' || frame.event === 'error') res.end();
};

export const chatController = {
  async conversation(req, res) {
    const result = await chatService.conversation(req.auth.userId, req.validatedParams.kitId, req.validatedQuery.language, req.auth.plan);
    res.json(result);
  },

  async create(req, res) {
    res.status(201).json(await chatService.create(req.auth.userId, req.auth.plan, req.body));
  },

  async retry(req, res) {
    res.status(201).json(await chatService.retry(req.auth.userId, req.auth.plan, req.validatedParams.sessionId));
  },

  async stream(req, res) {
    const session = await chatService.prepareStream(req.auth.userId, req.validatedParams.sessionId);
    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.socket?.setNoDelay(true);
    const unsubscribe = await chatService.subscribe(session, req.auth.plan, req.get('Last-Event-ID'), (frame) => writeFrame(res, frame));
    req.on('close', unsubscribe);
  },
};
