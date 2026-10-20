import { fileURLToPath } from 'node:url';

process.env.MASTRA_TELEMETRY_DISABLED = '1';
const { AcpAgent } = await import('@mastra/acp');
const stopReason = process.argv[2] ?? 'cancelled';
const unhandled = [];
const handledLater = [];
const onUnhandled = error => unhandled.push(error.message);
const onHandled = () => handledLater.push(true);
process.on('unhandledRejection', onUnhandled);
process.on('rejectionHandled', onHandled);

const agent = new AcpAgent({
  id: 'repro',
  description: 'Local ACP peer',
  command: process.execPath,
  args: [fileURLToPath(new URL('./peer.mjs', import.meta.url)), stopReason],
  cwd: fileURLToPath(new URL('.', import.meta.url)),
  persistSession: false,
});

await agent.getAvailableModels();
const controller = new AbortController();
let outcome = { state: 'pending' };
const generation = agent.generate('hello', { abortSignal: controller.signal }).then(
  result => (outcome = { state: 'resolved', text: result.text }),
  error => (outcome = { state: 'rejected', message: error.message }),
);
let timer;
const observation = await Promise.race([
  generation,
  new Promise(resolve => {
    timer = setTimeout(() => resolve(outcome), 1000);
  }),
]);
clearTimeout(timer);
console.log(JSON.stringify({ stopReason, observation, unhandled }));

controller.abort(new Error('diagnostic cleanup'));
await generation;
agent.connection.disconnect();
await new Promise(resolve => setImmediate(resolve));
process.removeListener('unhandledRejection', onUnhandled);
process.removeListener('rejectionHandled', onHandled);
