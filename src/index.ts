import express, { Application } from 'express';
import dotenv from 'dotenv';
import userRouter from './routers/userRouter';
import itemRouter from './routers/itemRouter';

dotenv.config();

const app: Application = express();
app.use(express.json());

app.use('/api/auth', userRouter);
app.use('/api/inventory', itemRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
