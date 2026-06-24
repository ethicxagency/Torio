import { IsOptional, IsString, IsArray } from "class-validator";

export class CreateNoteDto {
  @IsString()
  content!: string;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mentions?: string[];
}
