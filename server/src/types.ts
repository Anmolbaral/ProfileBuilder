import type { Request } from "express";
import type { PrismaClient } from "@prisma/client";

export interface Context {
  prisma: PrismaClient;
  req: Request;
}