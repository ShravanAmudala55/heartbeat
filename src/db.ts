import { PrismaClient } from "@prisma/client";

export type Db = PrismaClient;
export const createDb = (): Db => new PrismaClient();
