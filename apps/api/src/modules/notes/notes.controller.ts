import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { NotesService } from "./notes.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser, OrganizationId } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";
import { RequestUser } from "../../common/decorators/current-user.decorator";
import { CreateNoteDto } from "./dto/note.dto";

@Controller("notes")
@UseGuards(JwtAuthGuard, TenantGuard)
export class NotesController {
  constructor(private service: NotesService) {}

  @Get("conversation/:conversationId")
  @RequirePermissions(PERMISSIONS.NOTES_MANAGE)
  listByConversation(
    @OrganizationId() organizationId: string,
    @Param("conversationId") conversationId: string,
  ) {
    return this.service.listByConversation(organizationId, conversationId);
  }

  @Get("customer/:customerId")
  @RequirePermissions(PERMISSIONS.NOTES_MANAGE)
  listByCustomer(
    @OrganizationId() organizationId: string,
    @Param("customerId") customerId: string,
  ) {
    return this.service.listByCustomer(organizationId, customerId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.NOTES_MANAGE)
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateNoteDto,
  ) {
    return this.service.create(organizationId, user.id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.NOTES_MANAGE)
  remove(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.service.remove(organizationId, id);
  }
}
