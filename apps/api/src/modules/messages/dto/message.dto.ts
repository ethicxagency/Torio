import { IsEnum, IsOptional, IsString } from "class-validator";
import { MessageContentType } from "@prisma/client";

export class SendMessageDto {
  @IsString()
  content!: string;

  @IsEnum(MessageContentType)
  @IsOptional()
  contentType?: MessageContentType;
}

export class ListMessagesDto {
  @IsOptional()
  @IsString()
  cursor?: string;
}
