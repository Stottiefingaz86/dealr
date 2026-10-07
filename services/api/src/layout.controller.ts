import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import {
  DEFAULT_TABLE_LAYOUT,
  normalizeTableLayout,
  type TableLayout,
} from "@live-dealr/environments";

const layouts = new Map<string, TableLayout>([["BJ-001", DEFAULT_TABLE_LAYOUT]]);

@Controller("tables")
export class LayoutController {
  @Get(":tableId/layout")
  getLayout(@Param("tableId") tableId: string) {
    return layouts.get(tableId) ?? DEFAULT_TABLE_LAYOUT;
  }

  @Put(":tableId/layout")
  saveLayout(@Param("tableId") tableId: string, @Body() body: Partial<TableLayout>) {
    const next = normalizeTableLayout({ ...(layouts.get(tableId) ?? DEFAULT_TABLE_LAYOUT), ...body });
    layouts.set(tableId, next);
    return next;
  }
}
