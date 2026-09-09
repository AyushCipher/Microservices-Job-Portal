import axios from "axios";
import getBuffer from "../utils/buffer.js";
import { sql } from "../utils/db.js";
import {
  ErrorHandler,
  TryCatch,
  signAccessToken,
  signRefreshToken,
  verifyToken,
  storeRefreshToken,
  isRefreshTokenValid,
  revokeRefreshToken,
  blacklistAccessToken,
  AccessTokenPayload,
  RefreshTokenPayload,
} from "@hireheaven/common";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { forgotPasswordTemplate } from "../templete.js";
import { publishToTopic } from "../producer.js";
import { redisClient } from "../utils/redisClient.js";


const issueTokenPair = async (user: { user_id: number; role: string }) => {
  const secret = process.env.JWT_SEC as string;
  const subject = { id: user.user_id, role: user.role };

  const { token: accessToken } = signAccessToken(subject, secret);
  const { token: refreshToken, jti } = signRefreshToken(subject, secret);

  await storeRefreshToken(redisClient, user.user_id, jti);

  return { accessToken, refreshToken };
};


export const registerUser = TryCatch(async (req, res, next) => {
  const { name, email, password, phoneNumber, role, bio } = req.body;

  const existingUsers =
    await sql`SELECT user_id FROM users WHERE email = ${email}`;

  if (existingUsers.length > 0) {
    throw new ErrorHandler(409, "User with this email already exists");
  }

  const hashPassword = await bcrypt.hash(password, 10);

  let registeredUser;       // let because there are two possible registration branches:- recruiter and jobseeker

  if (role === "recruiter") {
    const [user] =
      await sql`INSERT INTO users (name, email, password, phone_number, role) VALUES
               (${name}, ${email}, ${hashPassword}, ${phoneNumber}, ${role}) RETURNING user_id, name, email, phone_number, role, created_at`;

    registeredUser = user;
  } else if (role === "jobseeker") {
    const file = req.file;

    if (!file) {
      throw new ErrorHandler(400, "Resume file is required for jobseekers");
    }

    const fileBuffer = getBuffer(file);

    if (!fileBuffer || !fileBuffer.content) {
      throw new ErrorHandler(500, "Failed to generate file buffer");
    }

    const { data } = await axios.post(
      `${process.env.UPLOAD_SERVICE}/api/utils/upload`,
      { buffer: fileBuffer.content }
    );

    const [user] =
      await sql`INSERT INTO users (name, email, password, phone_number, role, bio, resume, resume_public_id) VALUES
               (${name}, ${email}, ${hashPassword}, ${phoneNumber}, ${role}, ${bio}, ${data.url}, ${data.public_id}) RETURNING user_id, name, email, phone_number, role, bio, resume, created_at`;

    registeredUser = user;
  } else {
    throw new ErrorHandler(400, "Invalid role");
  }

  const { accessToken, refreshToken } = await issueTokenPair({
    user_id: registeredUser.user_id,
    role: registeredUser.role,
  });

  res.json({
    message: "Account created successfully",
    user: registeredUser,
    accessToken,
    refreshToken,
  });
});


export const loginUser = TryCatch(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await sql`
  SELECT u.user_id, u.name, u.email, u.password, u.phone_number, u.role, u.bio, u.resume, u.profile_pic, u.subscription, ARRAY_AGG(s.name) FILTER (WHERE s.name IS NOT NULL) as skills FROM users u LEFT JOIN user_skills us ON u.user_id = us.user_id
  LEFT JOIN skills s ON us.skill_id = s.skill_id   
  WHERE u.email = ${email} GROUP BY u.user_id;
  `;

  if (user.length === 0) {
    throw new ErrorHandler(400, "Invalid credentials");
  }

  const userObject = user[0];

  const matchPassword = await bcrypt.compare(password, userObject.password);

  if (!matchPassword) {
    throw new ErrorHandler(400, "Invalid credentials");
  }

  userObject.skills = userObject.skills || [];

  delete userObject.password;

  const { accessToken, refreshToken } = await issueTokenPair({
    user_id: userObject.user_id,
    role: userObject.role,
  });

  res.json({
    message: "Logged in successfully",
    user: userObject,
    accessToken,
    refreshToken,
  });
});


export const refreshAccessToken = TryCatch(async (req, res, next) => {
  const { refreshToken } = req.body;

  const secret = process.env.JWT_SEC as string;

  let decoded: RefreshTokenPayload;   // Eventually decoded will contain a refresh-token payload

  try {
    decoded = verifyToken<RefreshTokenPayload>(refreshToken, secret);
  } catch (error) {
    throw new ErrorHandler(401, "Invalid or expired refresh token");
  }

  if (decoded.type !== "refresh" || !decoded.jti) {
    throw new ErrorHandler(401, "Invalid refresh token");
  }

  const valid = await isRefreshTokenValid(redisClient, decoded.jti);

  if (!valid) {
    throw new ErrorHandler(401, "Refresh token has been revoked or expired");
  }

  // Rotate: revoke the used refresh token and issue a brand new pair.
  await revokeRefreshToken(redisClient, decoded.jti);

  const { accessToken, refreshToken: newRefreshToken } = await issueTokenPair({
    user_id: decoded.id,
    role: decoded.role,
  });

  res.json({
    message: "Token refreshed",
    accessToken,
    refreshToken: newRefreshToken,
  });
});


export const logoutUser = TryCatch(async (req, res, next) => {
  const { refreshToken } = req.body;
  const secret = process.env.JWT_SEC as string;

  try {
    const decodedRefresh = verifyToken<RefreshTokenPayload>(
      refreshToken,
      secret
    );

    if (decodedRefresh.jti) {
      await revokeRefreshToken(redisClient, decodedRefresh.jti);
    }
  } catch (error) {
    // Refresh token already invalid/expired — nothing to revoke, proceed.
  }

  // Get Authorization header
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    const accessToken = authHeader.split(" ")[1];

    try {
      const decodedAccess = verifyToken<AccessTokenPayload>(
        accessToken,
        secret
      );

      if (decodedAccess.jti && decodedAccess.exp) {
        const remainingTtl = decodedAccess.exp - Math.floor(Date.now() / 1000);
        await blacklistAccessToken(redisClient, decodedAccess.jti, remainingTtl);
      }
    } catch (error) {
      // Access token already invalid/expired — nothing to blacklist.
    }
  }

  res.json({ message: "Logged out successfully" });
});


export const forgotPassword = TryCatch(async (req, res, next) => {
  const { email } = req.body;

  const users =
    await sql`SELECT user_id, email FROM users WHERE email = ${email}`;

  if (users.length === 0) {
    return res.json({
      message: "If that email exists, we have sent a reset link",
    });
  }
  const user = users[0];

  // creating a JWT specifically for password reset
  const resetToken = jwt.sign(
    {
      email: user.email,
      type: "reset",
    },
    process.env.JWT_SEC as string,
    { expiresIn: "15m" }
  );

  const resetLink = `${process.env.Frontend_Url}/reset/${resetToken}`;

  // Store reset token in Redis
  await redisClient.set(`forgot:${email}`, resetToken, {
    EX: 900,
  });

  const message = {
    to: email,
    subject: "RESET Your Password - hireheaven",
    html: forgotPasswordTemplate(resetLink),
  };

  // Sends the email request asynchronously through Kafka
  publishToTopic("send-mail", message).catch((error) => {
    console.error("Failed to send message", error);
  });

  res.json({
    message: "If that email exists, we have sent a reset link",
  });
});


export const resetPassword = TryCatch(async (req, res, next) => {
  const { token } = req.params;
  const { password } = req.body;

  let decoded: any;

  try {
    decoded = jwt.verify(token as string, process.env.JWT_SEC as string);
  } catch (error) {
    throw new ErrorHandler(400, "Token has expired");
  }

  if (decoded.type !== "reset") {
    throw new ErrorHandler(400, "Invalid token type");
  }

  const email = decoded.email;

  // To check the temporary memory database (Redis)
  const storedToken = await redisClient.get(`forgot:${email}`);

  // If storedToken is completely missing, it means the link was either already used or overwritten by a newer request
  // If storedToken doesn't exactly match the token the user handed over, it means this is an old link and the user has since requested a newer one
  if (!storedToken || storedToken !== token) {
    throw new ErrorHandler(400, "Token has expired");
  }

  const users = await sql`SELECT user_id FROM users WHERE email = ${email}`;

  if (users.length === 0) {
    throw new ErrorHandler(404, "User not found");
  }

  const user = users[0];

  const hashPassword = await bcrypt.hash(password, 10);

  await sql`UPDATE users SET password = ${hashPassword} WHERE user_id = ${user.user_id}`;

  // It makes the reset token one-time-use
  await redisClient.del(`forgot:${email}`);

  res.json({ message: "Password changed successfully" });
});
