import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const registerSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .regex(/[a-zA-Z]/, { message: "Password must contain at least one letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
  displayName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const googleOAuthSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  googleId: z.string(),
});

// Auth-specific rate limiting: 5 attempts per minute for security
const authRateLimit = {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: "1 minute",
      errorResponseBuilder: () => ({
        statusCode: 429,
        message: "Too many attempts. Please try again later.",
      }),
    },
  },
};

export async function authRoutes(fastify: FastifyInstance) {
  // Register (rate limited)
  fastify.post("/register", authRateLimit, async (request, reply) => {
    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      // Get the first error message for a cleaner user experience
      const firstError = result.error.errors[0];
      const message = firstError?.message || "Invalid input";
      return reply.status(400).send({ message, errors: result.error.flatten() });
    }

    const { email, password, displayName } = result.data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.status(409).send({ message: "Email already registered" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
      },
    });

    // Generate token
    const token = fastify.jwt.sign({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        totalKudos: user.totalKudos,
      },
      token,
    };
  });

  // Login (rate limited)
  fastify.post("/login", authRateLimit, async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ message: "Invalid input" });
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const token = fastify.jwt.sign({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        totalKudos: user.totalKudos,
      },
      token,
    };
  });

  // Google OAuth callback
  fastify.post("/oauth/google", async (request, reply) => {
    const result = googleOAuthSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ message: "Invalid input" });
    }

    const { email, name, googleId } = result.data;

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          displayName: name,
          googleId,
        },
      });
    } else if (!user.googleId) {
      // Link Google account to existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId },
      });
    }

    const token = fastify.jwt.sign({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        totalKudos: user.totalKudos,
      },
      token,
    };
  });
}
