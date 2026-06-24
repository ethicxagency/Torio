import { Controller, Get, Param } from "@nestjs/common";
import { PlansService } from "./plans.service";
import { Public } from "../../common/decorators/auth.decorators";

@Controller("plans")
export class PlansController {
  constructor(private service: PlansService) {}

  @Public()
  @Get()
  list() {
    return this.service.findAll();
  }

  @Public()
  @Get(":slug")
  get(@Param("slug") slug: string) {
    return this.service.findBySlug(slug);
  }
}
