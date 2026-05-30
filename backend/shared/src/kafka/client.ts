import { Kafka, logLevel, CompressionTypes } from "kafkajs";

type KafkaClientConfig = {
  brokers: string[];
  clientId?: string;
};

export class KafkaClient {
  private kafka: Kafka;

  constructor(config: KafkaClientConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId || "ecommerce-app",
      brokers: config.brokers,
      logLevel: logLevel.INFO,
    });
  }

  async createProducer() {
    const producer = this.kafka.producer();
    await producer.connect();
    return producer;
  }

  async createConsumer(groupId: string) {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    return consumer;
  }

  // Helper: produce a message (stringified payload) to a topic
  async produce(
    topic: string,
    key: string | null,
    message: any,
    producer?: any,
  ) {
    const p = producer || (await this.createProducer());
    const value =
      typeof message === "string" ? message : JSON.stringify(message);
    await p.send({
      topic,
      compression: CompressionTypes.GZIP,
      messages: [
        {
          key: key ?? undefined,
          value,
        },
      ],
    });
    if (!producer) await p.disconnect();
  }

  // Graceful disconnect when shutting down
  async disconnect() {
    // kafkajs clients are disconnected individually by consumer/producer
  }
}

export default KafkaClient;
