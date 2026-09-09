import { ErrorHandler, TryCatch } from "@hireheaven/common";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { sql } from "../utils/db.js";
import { instance } from "../index.js";
import crypto from "crypto";

export const checkOut = TryCatch(async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new ErrorHandler(401, "User not found");
  }

  const user_id = req.user.user_id;

  const [user] = await sql`SELECT * FROM users WHERE user_id = ${user_id}`;

  // Checks whether the user currently has a subscription
  const subTime = user?.subscription
    ? new Date(user.subscription).getTime()   // converts it into a JavaScript Date and then that date into milliseconds since Unix epoch
    : 0;

  const now = Date.now();                     // Gets the current timestamp in milliseconds

  const isSubscribed = subTime > now;         // If the subscription time is in the future, the user is still subscribed

  if (isSubscribed) {
    throw new ErrorHandler(400, "You already have a subscription");
  }

  const options = {
    amount: Number(119 * 100),
    currency: "INR",
    notes: {
      user_id: user_id.toString(),
    },
  };

  // Razorpay creates an order and returns something like order_id, amount, currency, status, created_at ,etc. which is then sent to the frontend to complete the payment
  const order = await instance.orders.create(options);

  res.status(201).json({
    order,
  });
});


// This runs after the payment attempt as frontend sends the payment details to the backend for verification
export const paymentVerification = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    // Creates a string by concatenating the order ID and payment ID with a "|" separator. This string is used to generate a hash for verifying the authenticity of the payment.
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.Razorpay_Secret as string)
      .update(body)
      .digest("hex");

      
    const isAuthentic = expectedSignature === razorpay_signature;
    // If the signature is authentic, update the user's subscription status
    if (isAuthentic) {
      const now = new Date();

      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      const expiryDate = new Date(now.getTime() + thirtyDays);

      const [updatedUser] =
        await sql`UPDATE users SET subscription = ${expiryDate} WHERE user_id = ${user?.user_id} RETURNING *`;

      res.json({
        message: "Subscription purchased successfully",
        updatedUser,
      });
    } else {
      return res.status(400).json({
        message: "Payment failed",
      });
    }
  }
);
