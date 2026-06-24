import { Type } from "class-transformer";
import { IsArray, IsEmail, IsOptional, IsString, IsUrl, ValidateNested } from "class-validator";

export class BusinessInfoStepDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  facebookPage?: string;
}

export class KnowledgeItemDto {
  @IsString()
  title!: string;

  @IsString()
  content!: string;
}

export class KnowledgeStepDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KnowledgeItemDto)
  items!: KnowledgeItemDto[];
}

export class InviteTeamStepDto {
  @IsArray()
  @IsEmail({}, { each: true })
  emails!: string[];
}
