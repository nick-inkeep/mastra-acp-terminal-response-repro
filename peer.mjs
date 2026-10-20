import { createInterface } from 'node:readline';

const stopReason = process.argv[2];
const send = message => process.stdout.write(`${JSON.stringify(message)}\n`);
let pendingPromptId;

for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (request.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: request.id,
      result: { protocolVersion: 1, agentCapabilities: {}, authMethods: [] },
    });
  } else if (request.method === 'session/new') {
    send({ jsonrpc: '2.0', id: request.id, result: { sessionId: 'repro-session' } });
  } else if (request.method === 'session/prompt') {
    send({
      jsonrpc: '2.0',
      method: 'session/update',
      params: {
        sessionId: 'repro-session',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'hello' },
        },
      },
    });
    if (stopReason === 'wait_for_cancel') {
      pendingPromptId = request.id;
    } else if (stopReason === 'rpc_error') {
      send({ jsonrpc: '2.0', id: request.id, error: { code: -32603, message: 'peer failed' } });
    } else {
      send({ jsonrpc: '2.0', id: request.id, result: { stopReason } });
    }
  } else if (request.method === 'session/cancel' && pendingPromptId !== undefined) {
    send({ jsonrpc: '2.0', id: pendingPromptId, result: { stopReason: 'cancelled' } });
    pendingPromptId = undefined;
  }
}
