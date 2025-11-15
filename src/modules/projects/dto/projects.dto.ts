export class CreateProjectDto {
  name: string;
  email: string; // Project login email
  projectType: string;
  address: string;
  city: string;
  state: string;
  country: string;
}

export class EditProjectDto {
  id: string;
  name: string;
  projectType: string;
  address: string;
  city: string;
  state: string;
  country: string;
}

export class SearchProjectDto {
  query?: string;
  startDate?: Date;
  endDate?: Date;
  projectType?: string;
  country?: string;
  state?: string;
  city?: string;
}

