// Marketing Delivery Queue (Fase 12)
// Encolado simple sin dependencias externas — escala vía microservicio independiente después

import { eq } from "drizzle-orm";
import { miniappClient } from "./miniapp-client";
import { campaigns } from "@rabbitty/database-restaurant";
import { getRestaurantDb } from "../db";

export interface CampaignTask {
  campaignId: string;
  name: string;
  message: string;
  customerPhones: string[];
}

const queue: CampaignTask[] = [];
let processing = false;

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const task = queue.shift()!;
    let delivered = 0;
    let failed = 0;

    for (const phone of task.customerPhones) {
      try {
        const user = await miniappClient.lookupUserByPhone(phone);
        if (user.exists && user.userId) {
          await miniappClient.sendNotification({
            userId: user.userId,
            title: task.name,
            message: task.message,
            type: "MARKETING",
          });
          delivered++;
        }
      } catch {
        failed++;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log(`Campaign "${task.name}": ${delivered} delivered, ${failed} failed`);

    try {
      const db = getRestaurantDb();
      await db.update(campaigns)
        .set({ deliveredCount: delivered, failedCount: failed })
        .where(eq(campaigns.id, task.campaignId));
    } catch (err) {
      console.error(`Failed to persist analytics for campaign ${task.campaignId}:`, err);
    }
  }

  processing = false;
}

export function enqueueCampaignDelivery(task: CampaignTask) {
  queue.push(task);
  processQueue();
}

console.log("Marketing Delivery Queue initialized.");
