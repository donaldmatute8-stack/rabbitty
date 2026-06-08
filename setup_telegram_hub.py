import asyncio
import os
from telegram import Bot
from telegram.constants import ParseMode

# Secrets from environment
BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
HUB_USERNAME = "rabbittyhub"

async def setup_hub():
    bot = Bot(token=BOT_TOKEN)
    
    # Note: A Bot cannot "create" groups/channels inside a community (Topic) 
    # if it's not an admin of the Supergroup. 
    # Since we are in a 'Hub' (Telegram Community/Forum), 
    # we need to create TOPICS within the main group.
    
    try:
        # 1. Get the chat ID for @rabbittyhub
        chat = await bot.get_chat(f"@{HUB_USERNAME}")
        chat_id = chat.id
        print(f"Chat ID for @{HUB_USERNAME}: {chat_id}")

        # 2. Define the needed topics
        topics = {
            "Marketing": "Private space for Marco & Marketing Team. Strategies, gems, and coordination.",
            "Rabbiters": "Global/Public community for all Rabbiters.",
            "Affiliates": "Restricted space for verified Affiliates.",
            "Soporte": "Public support channel for users."
        }

        for name, desc in topics.items():
            try:
                # Create a forum topic
                topic = await bot.create_forum_topic(chat_id, name)
                print(f"Created topic: {name} (ID: {topic.forum_topic_id})")
                
                # Send initial description/welcome message to the topic
                await bot.send_message(
                    chat_id=chat_id,
                    message_thread_id=topic.message_thread_id,
                    text=f"<b>Welcome to {name}</b>\n\n{desc}",
                    parse_mode=ParseMode.HTML
                )
            except Exception as e:
                print(f"Could not create topic {name}: {e}")

        print("\n--- Hub Setup Complete ---")
        print("Next steps: Marco needs to manually set permissions for the 'Marketing' and 'Affiliates' topics via Telegram UI as bots have limited permission-management API for forum topics.")

    except Exception as e:
        print(f"Fatal Error: {e}")

if __name__ == "__main__":
    asyncio.run(setup_hub())
