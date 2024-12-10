import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const validRoles = ['ADMIN', 'TEACHER', 'STUDENT']; // Define allowed roles

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, password, role } = req.body;

        // Validate role
        if (!validRoles.includes(role)) {
            res.status(400).json({ message: 'Invalid role. valid roles: ADMIN, TEACHER, STUDENT' });
            return;
        }

        // Check if username already exists
        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            res.status(400).json({ message: 'Username already taken' });
            return;
        }

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: { username, password: hashedPassword, role },
        });

        res.status(201).json({ message: 'User registered successfully', user: newUser });
    } catch (err) {
        const error = err as Error; // Type assertion
        res.status(500).json({ message: 'Error creating user', error: error.message });
    }
};


export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, password } = req.body;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET as string, {
        });

        res.status(200).json({ message: 'Login successful', token });
    } catch (err) {
        const error = err as Error;
        res.status(500).json({ message: 'Error during login', error: error.message });
    }
};