import { CurrentUser } from '@/types/user';
import { Request } from 'express';

interface RequestWithUser extends Request {
    user?: CurrentUser;
    project?: {
        projectId: string;
        name: string;
        email: string;
    };
}

export { RequestWithUser };