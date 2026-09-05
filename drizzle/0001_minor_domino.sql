CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_name` text NOT NULL,
	`contact_person` text,
	`phone` text,
	`email` text,
	`address` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
