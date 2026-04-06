import { sql } from "drizzle-orm";
import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const signatures = sqliteTable("signatures", {
  id:                text("id").primaryKey(),
  name:              text("name").notNull(),
  fullName:          text("full_name").notNull(),
  title:             text("title").notNull(),
  phone:             text("phone").notNull(),
  fax:               text("fax"),
  direct:            text("direct"),
  sms:               text("sms"), 
  email:             text("email").notNull(),
  address:           text("address").notNull(),
  website:           text("website"),
  lic:               text("lic"),
  partnerLogoUrl:    text("partner_logo_url"),
  partnerLogoWidth:  integer("partner_logo_width"),
  partnerLogoHeight: integer("partner_logo_height"),
  createdAt:         text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt:         text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});