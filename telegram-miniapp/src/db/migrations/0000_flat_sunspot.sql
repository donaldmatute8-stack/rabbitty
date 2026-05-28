CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`participant1` text NOT NULL,
	`participant2` text NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversationId` text NOT NULL,
	`senderId` text NOT NULL,
	`content` text NOT NULL,
	`createdAt` integer,
	FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ownedBusinesses` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`address` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`logoUrl` text,
	`gallery` text DEFAULT '[]' NOT NULL,
	`rewardPercentage` integer DEFAULT 10 NOT NULL,
	`createdAt` integer,
	`updatedAt` integer,
	`status` text DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	`verificationMethod` text,
	`verificationData` text,
	`activeDays` text DEFAULT '[1,2,3,4,5,6,7]' NOT NULL,
	`startTime` text DEFAULT '00:00' NOT NULL,
	`endTime` text DEFAULT '23:59' NOT NULL,
	`timezone` text DEFAULT 'America/Mexico_City' NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`businessId` text NOT NULL,
	`fiatAmount` real NOT NULL,
	`bunzMinted` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`txHash` text,
	`errorMessage` text,
	`ticketUrl` text,
	`createdAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`businessId`) REFERENCES `ownedBusinesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`telegramId` text NOT NULL,
	`username` text,
	`firstName` text,
	`lastName` text,
	`tonWalletAddress` text,
	`totalBunzEarned` integer DEFAULT 0 NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_telegramId_unique` ON `users` (`telegramId`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_tonWalletAddress_unique` ON `users` (`tonWalletAddress`);--> statement-breakpoint
CREATE TABLE `webSessions` (
	`id` text PRIMARY KEY NOT NULL,
	`jwtToken` text NOT NULL,
	`userId` text,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webSessions_jwtToken_unique` ON `webSessions` (`jwtToken`);