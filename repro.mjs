import { fileURLToPath } from 'node:url';

process.env.MASTRA_TELEMETRY_DISABLED = '1';
const { AcpAgent } = await import('@mastra/acp');
const stopReason = process.argv[2] ?? 'cancelled';
const agent = new AcpAgent({
  id: 'repro',
  description: 'Local ACP peer',
  command: process.execPath,
  args: [
    fileURLToPath(new URL('./peer.mjs', import.meta.url)),
    stopReason === 'cancel_requested' ? 'wait_for_cancel' : stopReason,
  ],
  cwd: fileURLToPath(new URL('.', import.meta.url)),
  persistSession: false,
  createClient(client) {
    if (stopReason === 'cancel_requested') {
      const sessionUpdate = client.sessionUpdate.bind(client);
      client.sessionUpdate = async notification => {
        await sessionUpdate(notification);
        await agent.connection.cancel();
      };
    }
    return client;
  },
});

try {
  const result = await agent.generate('hello');
  console.log(JSON.stringify({ outcome: 'resolved', text: result.text }));
} catch (error) {
  console.log(JSON.stringify({ outcome: 'caught', message: error.message }));
} finally {
  agent.connection.disconnect();
}
