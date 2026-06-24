import { IsEnum, IsObject, IsOptional, IsString } from "class-validator";
import { SegmentType } from "@prisma/client";

export class CreateSegmentDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  filters?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  color?: string;
}

export class UpdateSegmentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  filters?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  color?: string;
}

export class SegmentQueryDto {
  @IsEnum(SegmentType)
  @IsOptional()
  type?: SegmentType;
}
