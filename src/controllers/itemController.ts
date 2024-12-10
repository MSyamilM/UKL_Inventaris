import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const isValidDate = (dateStr: string): boolean => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) return false;

    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
};

const validateDateRange = (startDate: string, endDate: string): string | null => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
        return `'start_date' must be before or the same as 'end_date'`;
    }
    return null;
};


const validateData = (data: Record<string, any>, schema: Record<string, string>): string | null => {
    for (const [key, type] of Object.entries(schema)) {
        if (data[key] === undefined || data[key] === null) {
            return `Field '${key}' is required`;
        }
        if (type === 'int') {
            if (!Number.isInteger(data[key]) || data[key] <= 0) {
                return `Field '${key}' must be a positive integer greater than zero`;
            }
        }
        if (type === 'string' && typeof data[key] !== 'string') {
            return `Field '${key}' must be a string`;
        }
        if (type === 'date' && typeof data[key] === 'string' && !isValidDate(data[key])) {
            return `Field '${key}' must be a valid date in YYYY-MM-DD format`;
        }
    }
    return null;
};


export const addItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, category, location, quantity } = req.body;

        // Validate input data
        const validationError = validateData(req.body, {
            name: 'string',
            category: 'string',
            location: 'string',
            quantity: 'int',
        });

        if (validationError) {
            res.status(400).json({ message: validationError });
            return;
        }

        const newItem = await prisma.item.create({
            data: { name, category, location, quantity, status: 'AVAILABLE' },
        });

        res.status(201).json({ message: 'Item added successfully', item: newItem });
    } catch (err) {
        const error = err as Error;
        res.status(500).json({ message: 'Error adding item', error: error.message });
    }
};

export const updateItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, category, location, quantity, status } = req.body;

        // Validate ID
        if (!id || isNaN(parseInt(id, 10))) {
            res.status(400).json({ message: 'Invalid or missing id parameter' });
            return;
        }

        const itemId = parseInt(id, 10);

        // Check if item exists
        const existingItem = await prisma.item.findUnique({ where: { id: itemId } });
        if (!existingItem) {
            res.status(404).json({ message: 'Item not found' });
            return;
        }

        // Validate input data
        const validationError = validateData(req.body, {
            name: 'string',
            category: 'string',
            location: 'string',
            quantity: 'int',
            status: 'string',
        });

        if (validationError) {
            res.status(400).json({ message: validationError });
            return;
        }

        // Validate status value
        const allowedStatuses = ['AVAILABLE', 'BORROWED', 'DAMAGED', 'LOST'];
        if (!allowedStatuses.includes(status)) {
            res.status(400).json({ message: `Invalid status value. Allowed values are: ${allowedStatuses.join(', ')}` });
            return;
        }

        // Update item
        const updatedItem = await prisma.item.update({
            where: { id: itemId },
            data: { name, category, location, quantity, status },
        });

        res.status(200).json({ message: 'Item updated successfully', item: updatedItem });
    } catch (err) {
        const error = err as Error;
        res.status(500).json({ message: 'Error updating item', error: error.message });
    }
};


export const getItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        // Validate ID
        if (!id || isNaN(parseInt(id, 10))) {
            res.status(400).json({ message: 'Invalid or missing id parameter' });
            return;
        }

        const item = await prisma.item.findUnique({ where: { id: parseInt(id, 10) } });

        // Check if item exists
        if (!item) {
            res.status(404).json({ message: 'Item not found' });
            return;
        }

        res.status(200).json(item);
    } catch (err) {
        const error = err as Error;
        res.status(500).json({ message: 'Error fetching item', error: error.message });
    }
};

export const borrowAnalysis = async (req: Request, res: Response): Promise<void> => {
    try {
        const { start_date, end_date } = req.body;

        // Validate input data
        const validationError = validateData(req.body, {
            start_date: 'date',
            end_date: 'date',
        });

        if (validationError) {
            res.status(400).json({ status: 'error', message: validationError });
            return;
        }

        // Validate date range
        const dateRangeError = validateDateRange(start_date, end_date);
        if (dateRangeError) {
            res.status(400).json({ status: 'error', message: dateRangeError });
            return;
        }

        const frequentBorrows = await prisma.borrow.groupBy({
            by: ['itemId'],
            _count: { itemId: true },
            where: {
                borrowDate: {
                    gte: new Date(start_date),
                    lte: new Date(end_date),
                },
                status: 'RETURNED',
            },
            orderBy: { _count: { itemId: 'desc' } },
        });

        const lateReturns = await prisma.borrow.groupBy({
            by: ['itemId'],
            _count: { itemId: true },
            where: {
                borrowDate: {
                    gte: new Date(start_date),
                    lte: new Date(end_date),
                },
                status: 'LATE',
            },
            orderBy: { _count: { itemId: 'desc' } },
        });

        const frequentlyBorrowedItems = await Promise.all(
            frequentBorrows.map(async (entry) => {
                const item = await prisma.item.findUnique({
                    where: { id: entry.itemId },
                });
                return {
                    item_id: item?.id,
                    name: item?.name,
                    category: item?.category || 'Uncategorized',
                    total_borrowed: entry._count.itemId,
                };
            })
        );

        const inefficientItems = await Promise.all(
            lateReturns.map(async (entry) => {
                const item = await prisma.item.findUnique({
                    where: { id: entry.itemId },
                });
                return {
                    item_id: item?.id,
                    name: item?.name,
                    category: item?.category || 'Uncategorized',
                    total_borrowed: entry._count.itemId,
                    total_late_returns: entry._count.itemId,
                };
            })
        );

        res.status(200).json({
            status: 'success',
            data: {
                analysis_period: {
                    start_date,
                    end_date,
                },
                frequently_borrowed_items: frequentlyBorrowedItems,
                inefficient_items: inefficientItems,
            },
        });
    } catch (err) {
        const error = err as Error;
        res.status(500).json({ status: 'error', message: 'Error generating borrow analysis', error: error.message });
    }
};

export const usageReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const { start_date, end_date, group_by } = req.body;

        const validationError = validateData(req.body, {
            start_date: 'date',
            end_date: 'date',
            group_by: 'string',
        });

        if (validationError) {
            res.status(400).json({ message: validationError });
            return;
        }

        const dateRangeError = validateDateRange(start_date, end_date);
        if (dateRangeError) {
            res.status(400).json({ message: dateRangeError });
            return;
        }

        if (!['category', 'location'].includes(group_by)) {
            res.status(400).json({ message: 'Invalid group_by value. Must be "category" or "location".' });
            return;
        }

        const groupByField = group_by as 'category' | 'location';

        const borrowData = await prisma.borrow.findMany({
            where: {
                borrowDate: {
                    gte: new Date(start_date),
                    lte: new Date(end_date),
                },
            },
            include: {
                Item: true,
            },
        });

        const usageAnalysis: Record<string, {
            group: string;
            total_borrowed: number;
            total_returned: number;
            items_in_use: number;
        }> = {};

        borrowData.forEach((borrow) => {
            const item = borrow.Item as Record<string, any>;
            const group = item?.[groupByField] || 'Unknown';

            if (!usageAnalysis[group]) {
                usageAnalysis[group] = {
                    group,
                    total_borrowed: 0,
                    total_returned: 0,
                    items_in_use: 0,
                };
            }

            usageAnalysis[group].total_borrowed += 1;
            if (borrow.returnDate) {
                usageAnalysis[group].total_returned += 1;
            } else {
                usageAnalysis[group].items_in_use += 1;
            }
        });

        const analysisPeriod = {
            start_date,
            end_date,
        };

        const usageReportData = Object.values(usageAnalysis);

        res.status(200).json({
            status: 'success',
            data: {
                analysis_period: analysisPeriod,
                usage_analysis: usageReportData,
            },
        });
    } catch (err) {
        const error = err as Error;
        res.status(500).json({ message: 'Error generating usage report', error: error.message });
    }
};
