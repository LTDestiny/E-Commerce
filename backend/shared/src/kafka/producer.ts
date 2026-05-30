import { KafkaClient } from "./client";

export async function produceMessage(
  bootstrapServers: string,
  clientId: string,
  topic: string,
  key: string | null,
  message: any,
) {
  const client = new KafkaClient({
    brokers: bootstrapServers.split(",").map((s) => s.trim()),
    clientId,
  });
  const producer = await client.createProducer();
  try {
    const value =
      typeof message === "string" ? message : JSON.stringify(message);
    await producer.send({
      topic,
      messages: [{ key: key ?? undefined, value }],
    });
  } finally {
    try {
      await producer.disconnect();
    } catch {}
  }
}

export default produceMessage;
