import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

interface AuthenticatedRequest extends Request {
    user?: JwtPayload | string;
}

export const authenticateAndAuthorize = (roles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void | Promise<void> => {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];

        if (!token) {
            res.status(401).json({ message: 'Access denied, token missing!' });
            return;
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
            req.user = decoded;

            if (!roles.includes(req.user.role)) {
                res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource.' });
                return;
            }

            next();
        } catch (err) {
            const error = err as Error;
            res.status(401).json({ message: 'Invalid token', error: error.message });
        }
    };
};
