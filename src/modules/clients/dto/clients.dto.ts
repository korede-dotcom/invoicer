import { Currency } from "@invoicerr/prisma";

export class EditClientsDto {
    description?: string
    legalId?: string
    VAT?: string
    foundedAt?: Date;
    id: string;
    name: string;
    contactFirstname: string;
    contactLastname: string;
    contactEmail: string;
    contactPhone: string;
    address: string;
    postalCode: string;
    city: string;
    country: string;
    currency: Currency;
    isActive: boolean;
    projectId?: string;
}

export class SearchClientsDto {
    query?: string;
    startDate?: Date;
    endDate?: Date;
    projectId?: string;
}