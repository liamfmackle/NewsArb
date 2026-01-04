import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "./routes/auth.js";
import { storiesRoutes } from "./routes/stories.js";
import { marketsRoutes } from "./routes/markets.js";
import { usersRoutes } from "./routes/users.js";
import { viralityRoutes } from "./routes/virality.js";
import { leaderboardsRoutes } from "./routes/leaderboards.js";
import { prisma } from "./lib/prisma.js";
import { startViralityTracker, stopViralityTracker } from "./jobs/viralityTracker.js";
import { startKudosCalculator, stopKudosCalculator } from "./jobs/kudosCalculator.js";

// Require JWT_SECRET in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  console.error("FATAL: JWT_SECRET environment variable is required in production");
  process.exit(1);
}

const fastify = Fastify({
  logger: true,
});

// Register plugins
await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
});

await fastify.register(jwt, {
  secret: JWT_SECRET || "dev-only-secret-do-not-use-in-production",
});

// Global rate limit
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});


// Auth decorator - verifies JWT token
fastify.decorate("authenticate", async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ message: "Unauthorized" });
  }
});

// Admin decorator - verifies JWT token AND checks admin role
fastify.decorate("authenticateAdmin", async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
    const userId = request.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== "admin") {
      return reply.status(403).send({ message: "Forbidden: Admin access required" });
    }
  } catch (err) {
    reply.status(401).send({ message: "Unauthorized" });
  }
});

// Health check
fastify.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Register routes
await fastify.register(authRoutes, { prefix: "/auth" });
await fastify.register(storiesRoutes, { prefix: "/stories" });
await fastify.register(marketsRoutes, { prefix: "/markets" });
await fastify.register(usersRoutes, { prefix: "/users" });
await fastify.register(viralityRoutes, { prefix: "/virality" });
await fastify.register(leaderboardsRoutes, { prefix: "/leaderboards" });

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || "3001", 10);
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`Server running on http://localhost:${port}`);

    // Start background jobs
    startViralityTracker();
    startKudosCalculator();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  console.log("Shutting down...");
  stopViralityTracker();
  stopKudosCalculator();
  await fastify.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start();
