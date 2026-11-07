CREATE INDEX `expenses_date_idx` ON `expenses` (`date`);--> statement-breakpoint
CREATE INDEX `products_archived_idx` ON `products` (`archived_at`);--> statement-breakpoint
CREATE INDEX `sale_items_product_idx` ON `sale_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `sales_status_created_idx` ON `sales` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `stock_adjustments_created_idx` ON `stock_adjustments` (`created_at`);