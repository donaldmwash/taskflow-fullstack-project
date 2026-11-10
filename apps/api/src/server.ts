import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createTaskSchema, loginSchema, registerSchema, updateTaskSchema } from "./schemas.js";

dotenv.config({ path: "../../.env" });

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  NODE_ENV: z.string().default("development")
});

const environment = environmentSchema.parse(process.env);
const prisma = new PrismaClient();
const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: environment.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

const sessionCookie = "taskflow_session";
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: environment.NODE_ENV === "production",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

type Session = {
  userId: string;
  workspaceId: string;
};

function readSession(request: express.Request): Session | null {
  try {
    return jwt.verify(request.cookies?.[sessionCookie], environment.JWT_SECRET) as Session;
  } catch {
    return null;
  }
}

function asyncRoute(
  handler: (request: express.Request, response: express.Response) => Promise<unknown>
) {
  return (
    request: express.Request,
    response: express.Response,
    next: express.NextFunction
  ) => {
    void handler(request, response).catch(next);
  };
}

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "taskflow-api" });
});

app.post("/api/auth/register", authLimiter, asyncRoute(async (request, response) => {
  const input = registerSchema.parse(request.body);
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email }
  });

  if (existingUser) {
    return response.status(409).json({ error: "An account with this email already exists." });
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
      workspace: {
        create: { name: input.name + "'s workspace" }
      }
    },
    include: { workspace: true }
  });

  const session = { userId: user.id, workspaceId: user.workspace!.id };
  response.cookie(
    sessionCookie,
    jwt.sign(session, environment.JWT_SECRET, { expiresIn: "7d" }),
    cookieOptions
  );

  return response.status(201).json({
    user: { id: user.id, name: user.name, email: user.email },
    workspaceId: user.workspace!.id
  });
}));

app.post("/api/auth/login", authLimiter, asyncRoute(async (request, response) => {
  const input = loginSchema.parse(request.body);
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { workspace: true }
  });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash)) || !user.workspace) {
    return response.status(401).json({ error: "Email or password is incorrect." });
  }

  const session = { userId: user.id, workspaceId: user.workspace.id };
  response.cookie(
    sessionCookie,
    jwt.sign(session, environment.JWT_SECRET, { expiresIn: "7d" }),
    cookieOptions
  );

  return response.json({
    user: { id: user.id, name: user.name, email: user.email },
    workspaceId: user.workspace.id
  });
}));

app.get("/api/auth/me", asyncRoute(async (request, response) => {
  const session = readSession(request);
  if (!session) {
    return response.status(401).json({ error: "Sign in to continue." });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true }
  });

  if (!user) {
    return response.status(401).json({ error: "Account not found." });
  }

  return response.json({ user, workspaceId: session.workspaceId });
}));

app.post("/api/auth/logout", (_request, response) => {
  response.clearCookie(sessionCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: environment.NODE_ENV === "production",
    path: "/"
  });
  response.status(204).end();
});

app.use("/api/tasks", (request, response, next) => {
  const session = readSession(request);
  if (!session) {
    return response.status(401).json({ error: "Sign in to continue." });
  }

  response.locals.session = session;
  next();
});

app.get("/api/tasks", asyncRoute(async (_request, response) => {
  const session = response.locals.session as Session;
  const tasks = await prisma.task.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { updatedAt: "desc" }
  });

  return response.json({ tasks });
}));

app.post("/api/tasks", asyncRoute(async (request, response) => {
  const input = createTaskSchema.parse(request.body);
  const session = response.locals.session as Session;

  const task = await prisma.task.create({
    data: {
      ...input,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      workspaceId: session.workspaceId
    }
  });

  return response.status(201).json({ task });
}));

app.patch("/api/tasks/:id", asyncRoute(async (request, response) => {
  const input = updateTaskSchema.parse(request.body);
  const session = response.locals.session as Session;
  const existingTask = await prisma.task.findFirst({
    where: { id: request.params.id, workspaceId: session.workspaceId },
    select: { id: true }
  });

  if (!existingTask) {
    return response.status(404).json({ error: "Task not found." });
  }

  const changes = {
    ...input,
    dueDate: input.dueDate === undefined
      ? undefined
      : input.dueDate === null ? null : new Date(input.dueDate)
  };

  const task = await prisma.task.update({
    where: { id: existingTask.id },
    data: changes
  });

  return response.json({ task });
}));

app.delete("/api/tasks/:id", asyncRoute(async (request, response) => {
  const session = response.locals.session as Session;
  const task = await prisma.task.findFirst({
    where: { id: request.params.id, workspaceId: session.workspaceId },
    select: { id: true }
  });

  if (!task) {
    return response.status(404).json({ error: "Task not found." });
  }

  await prisma.task.delete({ where: { id: task.id } });
  return response.status(204).end();
}));

app.use((_request, response) => {
  response.status(404).json({ error: "The requested endpoint does not exist." });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    return response.status(400).json({
      error: error.issues[0]?.message ?? "Invalid request."
    });
  }

  console.error("Unhandled API error:", error);
  return response.status(500).json({ error: "Something went wrong. Please try again." });
});

const server = app.listen(environment.API_PORT, () => {
  console.info("TaskFlow API listening on port " + environment.API_PORT);
});

async function shutDown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutDown());
process.on("SIGTERM", () => void shutDown());
