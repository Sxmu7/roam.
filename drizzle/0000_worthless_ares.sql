CREATE TABLE `join_attempts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`start` integer NOT NULL,
	`attempts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`joined_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_unique` ON `group_members` (`group_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `shared_clips` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`source_id` text NOT NULL,
	`metadata` text NOT NULL,
	`object_key` text NOT NULL,
	`bytes` integer NOT NULL,
	`complete` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_unique` ON `shared_clips` (`group_id`,`user_id`,`source_id`);--> statement-breakpoint
CREATE TABLE `travel_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner` text NOT NULL,
	`code` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `travel_groups_code_unique` ON `travel_groups` (`code`);