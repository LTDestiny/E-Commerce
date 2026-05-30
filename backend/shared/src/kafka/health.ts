import { Kafka } from "kafkajs";

export async function checkKafkaConnectivity(
  bootstrapServers: string,
  timeoutMs = 2000,
): Promise<boolean> {
  try {
    const brokers = bootstrapServers.split(",").map((s) => s.trim());
    const kafka = new Kafka({ brokers, clientId: "health-check" });
    const admin = kafka.admin();
    const timer = setTimeout(() => {
      try {
        admin.disconnect();
      } catch {}
    }, timeoutMs);
    await admin.connect();
    await admin.disconnect();
    clearTimeout(timer);
    return true;
  } catch (err) {
    return false;
  }
}

export default checkKafkaConnectivity;
