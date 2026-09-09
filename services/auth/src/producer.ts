import { Producer, Admin } from "kafkajs";
import { createKafkaClient } from "@hireheaven/common";
import dotenv from "dotenv";
dotenv.config();

// These variables will later hold Kafka clients
let producer: Producer;
let admin: Admin;


export const connectKafka = async () => {
  try {
    const kafka = createKafkaClient("auth-service");

    // Creates the Kafka admin client and connects to Kafka
    admin = kafka.admin();
    await admin.connect();

    // Gets existing Kafka topics
    const topics = await admin.listTopics();

    // If the "send-mail" topic doesn't exist, it creates it
    if (!topics.includes("send-mail")) {
      await admin.createTopics({
        topics: [
          {
            topic: "send-mail",     // The unique name of our data channel
            numPartitions: 1,       // This means all email messages will flow through a single log file in strict, unbroken chronological order
            replicationFactor: 1,   //  It tells Kafka to keep exactly 1 copy of this data. in production environments, we usually set this to 3 so that if one Kafka server machine crashes, the other two servers can instantly take over without losing any emails
          },
        ],
      });
      // This setup prevents backend from crashing later when it tries to publish or subscribe to a topic that doesn't exist yet
      console.log("✅ Topic 'send-mail' created");
    }

    await admin.disconnect();       // Disconnects the admin client after creating the topic since we needed it only inspect/create the topic

    producer = kafka.producer();

    await producer.connect();       // Connects the producer client to Kafka so that it can start sending messages to the "send-mail" topic    

    console.log("✅ Connected to kafka producer");

  } catch (error) {
    console.log("Failed to connect to kafka", error);
  }
};


export const publishToTopic = async (topic: string, message: any) => {
  if (!producer) {
    console.log("Kafka producer is not initialized");
    return;
  }

  try {
    await producer.send({
      topic: topic,
      messages: [
        {
          value: JSON.stringify(message),
        },
      ],
    });
  } catch (error) {
    console.log("Failed to publish message to kafka", error);
  }
};


export const disconnectKafka = async () => {
  if (producer) {
    producer.disconnect();
  }
};
