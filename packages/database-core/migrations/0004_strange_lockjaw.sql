CREATE TABLE "passkeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"credentialId" text NOT NULL,
	"publicKey" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" text DEFAULT '[]' NOT NULL,
	"deviceName" text,
	"createdAt" timestamp DEFAULT now(),
	CONSTRAINT "passkeys_credentialId_unique" UNIQUE("credentialId")
);
--> statement-breakpoint
CREATE TABLE "trustedSessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"deviceName" text,
	"userAgent" text,
	"ipAddress" text,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	CONSTRAINT "trustedSessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "supportWhatsApp" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totpSecret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totpEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "requireTotpForLogin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trustedSessions" ADD CONSTRAINT "trustedSessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;