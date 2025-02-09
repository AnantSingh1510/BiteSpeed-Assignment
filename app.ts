import express from 'express';
import { PrismaClient } from '@prisma/client';
import { identifyUser } from './identityService';

export const prisma = new PrismaClient();
const app = express();
const port = 3000;

app.use(express.json());

// @ts-ignore
app.post('/identify', identifyUser);

app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
});