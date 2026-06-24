import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ChannelType } from "@prisma/client";

export class MetaPageSelection {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  @MinLength(1)
  accessToken!: string;
}

export class SelectMetaPageDto {
  @IsString()
  pageId!: string;

  @IsString()
  @IsOptional()
  oauthState?: string;

  @IsEnum(ChannelType)
  @IsOptional()
  channelType?: ChannelType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetaPageSelection)
  @IsOptional()
  pages?: MetaPageSelection[];

  @IsString()
  @IsOptional()
  tokenExpiresAt?: string;

  @IsBoolean()
  @IsOptional()
  connectInstagram?: boolean;
}

export class ConnectWhatsAppDto {
  @IsString()
  businessAccountId!: string;

  @IsString()
  phoneNumberId!: string;

  @IsString()
  phoneNumber!: string;

  @IsString()
  accessToken!: string;

  @IsString()
  @IsOptional()
  displayName?: string;
}

export class StartOAuthDto {
  @IsEnum(ChannelType)
  channelType!: ChannelType;
}
