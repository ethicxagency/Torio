import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  CustomerStatus,
  CustomerType,
  LeadSource,
  AutoAssignmentStrategy,
} from "@prisma/client";

export class UpdateCustomerDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  facebookProfile?: string;

  @IsString()
  @IsOptional()
  instagramProfile?: string;

  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsEnum(CustomerType)
  @IsOptional()
  customerType?: CustomerType;

  @IsEnum(LeadSource)
  @IsOptional()
  leadSource?: LeadSource;

  @IsEnum(CustomerStatus)
  @IsOptional()
  status?: CustomerStatus;
}

export class AssignCustomerDto {
  @IsString()
  assignedToId!: string;
}

export class BulkCustomerActionDto {
  @IsArray()
  @IsString({ each: true })
  customerIds!: string[];

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  tagId?: string;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;
}

export class ImportCustomerRowDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @IsEnum(CustomerStatus)
  @IsOptional()
  status?: CustomerStatus;

  @IsString()
  @IsOptional()
  tags?: string;
}

export class ImportCustomersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportCustomerRowDto)
  rows!: ImportCustomerRowDto[];
}

export class UpdateCrmSettingsDto {
  @IsOptional()
  autoAssignmentEnabled?: boolean;

  @IsEnum(AutoAssignmentStrategy)
  @IsOptional()
  autoAssignmentStrategy?: AutoAssignmentStrategy;
}
