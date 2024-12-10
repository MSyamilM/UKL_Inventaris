import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default borrowing period in days (if no return date is provided)
const DEFAULT_BORROW_PERIOD = 7;

// Utility to validate date order
const validateDateOrder = (startDate: string, endDate: string): string | null => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
        return `'borrowDate' must be before or the same as 'returnDate'`;
    }
    return null;
};

export const borrowItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, itemId, borrowDate, returnDate } = req.body;

        // Validate required fields
        if (!userId || !itemId || !borrowDate) {
            res.status(400).json({ message: 'User ID, item ID, and borrow date are required' });
            return;
        }

        // Validate borrowDate format
        if (isNaN(Date.parse(borrowDate))) {
            res.status(400).json({ message: 'Invalid date format for borrowDate' });
            return;
        }

        // Validate returnDate format, if provided
        if (returnDate && isNaN(Date.parse(returnDate))) {
            res.status(400).json({ message: 'Invalid date format for returnDate' });
            return;
        }

        // Validate borrowDate and returnDate order, if returnDate is provided
        if (returnDate) {
            const dateOrderError = validateDateOrder(borrowDate, returnDate);
            if (dateOrderError) {
                res.status(400).json({ message: dateOrderError });
                return;
            }
        }

        // Check if user exists
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Check if item exists and is available
        const item = await prisma.item.findUnique({ where: { id: itemId } });
        if (!item) {
            res.status(404).json({ message: 'Item not found' });
            return;
        }

        if (item.status !== 'AVAILABLE') {
            res.status(400).json({ message: 'Item not available for borrowing' });
            return;
        }

        // Borrow the item
        const borrow = await prisma.borrow.create({
            data: {
                userId,
                itemId,
                borrowDate: new Date(borrowDate),
                returnDate: returnDate ? new Date(returnDate) : null,
                status: 'ONGOING',
            },
        });

        // Update item status
        await prisma.item.update({
            where: { id: itemId },
            data: { status: 'BORROWED' },
        });

        res.status(201).json({ message: 'Item borrowed successfully', borrow });
    } catch (err) {
        const error = err as Error;
        res.status(500).json({ message: 'Error borrowing item', error: error.message });
    }
};

export const returnItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { borrowId, returnDate } = req.body;

        // Validate required fields
        if (!borrowId || !returnDate) {
            res.status(400).json({ message: 'Borrow ID and return date are required' });
            return;
        }

        // Validate returnDate format
        if (isNaN(Date.parse(returnDate))) {
            res.status(400).json({ message: 'Invalid date format for returnDate' });
            return;
        }

        // Check if borrow record exists and is ongoing
        const borrow = await prisma.borrow.findUnique({ where: { id: borrowId } });
        if (!borrow) {
            res.status(404).json({ message: 'Borrow record not found' });
            return;
        }

        if (borrow.status !== 'ONGOING') {
            res.status(400).json({ message: 'Invalid borrow record or item already returned' });
            return;
        }

        // Validate borrowDate and returnDate order
        const dateOrderError = validateDateOrder(borrow.borrowDate.toISOString(), returnDate);
        if (dateOrderError) {
            res.status(400).json({ message: dateOrderError });
            return;
        }

        // Determine expected return date
        const expectedReturnDate = borrow.returnDate
            ? new Date(borrow.returnDate)
            : new Date(new Date(borrow.borrowDate).setDate(new Date(borrow.borrowDate).getDate() + DEFAULT_BORROW_PERIOD));

        // Determine if the return is late
        const isLate = new Date(returnDate) > expectedReturnDate;

        // Update borrow record
        const updatedBorrow = await prisma.borrow.update({
            where: { id: borrowId },
            data: {
                returnDate: new Date(returnDate),
                status: isLate ? 'LATE' : 'RETURNED',
            },
        });

        // Update item status
        await prisma.item.update({
            where: { id: borrow.itemId },
            data: { status: 'AVAILABLE' },
        });

        res.status(200).json({ message: 'Item returned successfully', borrow: updatedBorrow });
    } catch (err) {
        const error = err as Error;
        res.status(500).json({ message: 'Error returning item', error: error.message });
    }
};
