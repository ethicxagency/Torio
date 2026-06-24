import { IsEnum, IsOptional, IsString } from "class-validator";
import { ChannelType, ConversationStatus } from "@prisma/client";

export class ListConversationsDto {
  @IsOptional()
  @IsString()
  filter?: "all" | "open" | "assigned" | "unassigned" | "closed" | "mine";

  @IsOptional()
  @IsString()
  channelType?: string;

  @IsOptional()
  @IsString()
  channelId?: string;

  @IsOptional()
  @IsString()
  assignedAgentId?: string;

  @IsOptional()
  @IsString()
  tagId?: string;

  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  sort?: "lastMessageAt" | "createdAt";

  @IsOptional()
  @IsString()
  order?: "asc" | "desc";
}

export class UpdateConversationStatusDto {
  @IsEnum(ConversationStatus)
  status!: ConversationStatus;
}

export class AssignConversationDto {
  @IsString()
  assignedToId!: string;
}
