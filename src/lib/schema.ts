import { sql } from "drizzle-orm";
import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const signatures = sqliteTable("signatures", {
  id:                text("id").primaryKey(),
  name:              text("name").notNull(),
  fullName:          text("full_name").notNull(),
  title:             text("title").notNull(),
  contactLines:      text("contact_lines").notNull(),
  email:             text("email").notNull(),
  address:           text("address").notNull(),
  lic:               text("lic"),
  partnerLogoUrl:    text("partner_logo_url"),
  partnerLogoWidth:  integer("partner_logo_width"),
  partnerLogoHeight: integer("partner_logo_height"),
  createdAt:         text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt:         text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});