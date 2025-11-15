import { DashboardService } from "@/modules/dashboard/dashboard.service";
import { Controller, Get, Query } from "@nestjs/common";

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboardInfo(
    @Query('currency') currency?: string,
    @Query('period') period?: string
  ): Promise<any> {
    return await this.dashboardService.getDashboardData(currency, period);
  }
}
