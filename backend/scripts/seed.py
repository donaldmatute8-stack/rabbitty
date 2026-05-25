#!/usr/bin/env python3
"""Seed database with sample data for development."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal, init_db
from app.models import User, Business, Transaction, FeedEvent
from app.services.auth import generate_referral_code
from datetime import datetime, timezone


def seed_data():
    """Create sample data."""
    db = SessionLocal()
    
    try:
        # Create sample users
        users = []
        for i in range(1, 6):
            user = User(
                telegram_id=1000000000 + i,
                username=f"user{i}",
                first_name=f"User {i}",
                last_name=f"Test",
                referral_code=generate_referral_code(1000000000 + i),
                points=100.0 * i,
                bunz_balance=50.0 * i,
                is_active=True
            )
            users.append(user)
            db.add(user)
        
        db.commit()
        print(f"Created {len(users)} users")
        
        # Create sample businesses
        businesses = [
            {
                "name": "Coffee Corner",
                "category": "cafe",
                "address": "123 Main St, San Francisco, CA",
                "latitude": 37.7749,
                "longitude": -122.4194,
                "reward_percentage": 10.0,
                "rating": 4.5
            },
            {
                "name": "Burger Barn",
                "category": "restaurant",
                "address": "456 Oak Ave, San Francisco, CA",
                "latitude": 37.7849,
                "longitude": -122.4094,
                "reward_percentage": 8.0,
                "rating": 4.2
            },
            {
                "name": "Tech Gadgets",
                "category": "retail",
                "address": "789 Pine Rd, San Francisco, CA",
                "latitude": 37.7649,
                "longitude": -122.4294,
                "reward_percentage": 5.0,
                "rating": 4.7
            }
        ]
        
        biz_objects = []
        for biz_data in businesses:
            business = Business(
                name=biz_data["name"],
                category=biz_data["category"],
                address=biz_data["address"],
                latitude=biz_data["latitude"],
                longitude=biz_data["longitude"],
                reward_percentage=biz_data["reward_percentage"],
                rating=biz_data["rating"],
                owner_id=users[0].id,
                is_active=True,
                is_verified=True
            )
            biz_objects.append(business)
            db.add(business)
        
        db.commit()
        print(f"Created {len(biz_objects)} businesses")
        
        # Create sample transactions
        transactions = []
        for i in range(20):
            user = users[i % len(users)]
            business = biz_objects[i % len(biz_objects)]
            amount = 25.0 * (i + 1)
            points = amount * (business.reward_percentage / 100)
            
            transaction = Transaction(
                user_id=user.id,
                business_id=business.id,
                amount=amount,
                points_earned=points,
                transaction_type="earn",
                status="completed",
                qr_code=f"txn-{i}"
            )
            transactions.append(transaction)
            db.add(transaction)
        
        db.commit()
        print(f"Created {len(transactions)} transactions")
        
        # Create feed events
        for txn in transactions[:10]:
            event = FeedEvent(
                type="transaction",
                user_id=txn.user_id,
                business_id=txn.business_id,
                transaction_id=txn.id,
                content=f"Earned {txn.points_earned:.1f} points!",
                points=txn.points_earned,
                is_public=True
            )
            db.add(event)
        
        db.commit()
        print("Created feed events")
        
        print("\n✅ Database seeded successfully!")
        print(f"  - Users: {len(users)}")
        print(f"  - Businesses: {len(biz_objects)}")
        print(f"  - Transactions: {len(transactions)}")
        print(f"  - Feed Events: 10")
        
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("🌱 Seeding database...")
    init_db()
    seed_data()
