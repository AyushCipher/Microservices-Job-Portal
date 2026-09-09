import { createKafkaClient } from "@hireheaven/common";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const startSendMailConsumer = async () => {
  try {
    const kafka = createKafkaClient("mail-service");

    const consumer = kafka.consumer({ groupId: "mail-service-group" });

    await consumer.connect();

    const topicName = "send-mail";

    await consumer.subscribe({ topic: topicName, fromBeginning: false });
    // The fromBeginning: false option means that the consumer does not start from the earliest message in the topic. Instead, it processes new messages from its current position onward, 
    // preventing the service from unnecessarily processing old email events when it starts

    console.log("✅ Mail service consumer started, listening for sending mail");

    // The consumer continuously listens for new messages on the "send-mail" topic
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const { to, subject, html } = JSON.parse(     // The message.value is a Buffer, so we convert it to a string and then parse it as JSON to extract the email details
            message.value?.toString() || "{}"
          );

          const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          await transporter.sendMail({
            from: "Hireheaven <no-reply>",
            to,
            subject,
            html,
          });

          console.log(`Mail has been sent to ${to}`);
          
        } catch (error) {
          console.log("Failed to send mail", error);
        }
      },
    });

  } catch (error) {
    console.log("Failed to start kafka consumer", error);
  }
};