import { Currency } from "@invoicerr/prisma";

export class EditClientsDto {
    description?: string
    legalId?: string
    VAT?: string
    foundedAt?: Date;
    id?: string; // Optional for creation, required for editing
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
    isActive?: boolean; // Optional, defaults to true
    projectId?: string;
}

export class SearchClientsDto {
    query?: string;
    startDate?: Date;
    endDate?: Date;
    projectId?: string;
}