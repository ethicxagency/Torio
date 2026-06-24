import { IsEmail, IsEnum, IsOptional } from "class-validator";
import { MembershipRole } from "@prisma/client";

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(MembershipRole)
  @IsOptional()
  role?: MembershipRole;
}

export class UpdateMemberRoleDto {
  @IsEnum(MembershipRole)
  role!: MembershipRole;
}
