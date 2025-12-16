#!/usr/bin/env python3
"""
Order Seeding Script for diana_lee-demo Bakery
Creates realistic orders from Sept 25 to Dec 15, 2025
Excludes all Sundays
Distribution: 3% (0 orders), 30% (1), 40% (2), 20% (3), 7% (4)
"""

import json
import requests
import random
from datetime import datetime, timedelta
from pathlib import Path

# Configuration
API_URL = "https://us-central1-bake-ry.cloudfunctions.net/bake"
BAKERY_ID = "diana_lee-demo"
TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjM4MTFiMDdmMjhiODQxZjRiNDllNDgyNTg1ZmQ2NmQ1NWUzOGRiNWQiLCJ0eXAiOiJKV1QifQ.eyJyb2xlIjoic3lzdGVtX2FkbWluIiwiYmFrZXJ5SWQiOiJlcy1hbGltZW50byIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9iYWtlLXJ5IiwiYXVkIjoiYmFrZS1yeSIsImF1dGhfdGltZSI6MTc2NDk4NTQ1NiwidXNlcl9pZCI6InN5c3RlbS1hZG1pbiIsInN1YiI6InN5c3RlbS1hZG1pbiIsImlhdCI6MTc2NTgzMTMzMSwiZXhwIjoxNzY1ODM0OTMxLCJlbWFpbCI6ImRldkBjYXJzYWxoYXouY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsiZGV2QGNhcnNhbGhhei5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.lEXzJ8RUJVJHtMLJHvoLgBGLSQd6Hspeg5FhG9jij7UL_dFb9WUIw6nxCzV9YCyQyuoDceIQoEIcP5aCZuVLH_uA9Soa2b4uJC5HkSF_B6th3XC7H2Ppx0nJmH2WkSy4HmBp8shia6PD1pWuR-wst0eUOfWB1wcfxCR6dVs1nqe7QS5JJmA-58Me6Yo_WrDCoj2EpI2hzLEBUDUK6xDRE_njrl_W6lqo0a2otC0cdtv4K4-oLPcZCTJzA4qBxfxRZ_ljhdyqdwb73VsRt-OieUHtgTLtBMNmwjZavWt-I4eI_H08-NPawLXE_julrn8KcXoKDerSHmXd08FfIZLbvw"

START_DATE = datetime(2025, 9, 25)
END_DATE = datetime(2025, 12, 15)

DATA_DIR = Path("./seed-data")
USERS_FILE = DATA_DIR / "users.json"
PRODUCTS_FILE = DATA_DIR / "products.json"
LOG_FILE = DATA_DIR / "seeding.log"

# Colors
GREEN = '\033[0;32m'
RED = '\033[0;31m'
YELLOW = '\033[1;33m'
NC = '\033[0m'

# Counters
TOTAL_ORDERS = 0
SUCCESSFUL_ORDERS = 0
FAILED_ORDERS = 0
SKIPPED_SUNDAYS = 0


def load_data():
    """Load users and products from JSON files"""
    with open(USERS_FILE, 'r') as f:
        users_data = json.load(f)
    with open(PRODUCTS_FILE, 'r') as f:
        products_data = json.load(f)

    users = users_data.get('items', [])
    products = products_data.get('items', [])

    return users, products


def get_order_count():
    """Determine order count based on distribution"""
    rand = random.randint(1, 100)
    if rand <= 3:
        return 0
    elif rand <= 33:
        return 1
    elif rand <= 73:
        return 2
    elif rand <= 93:
        return 3
    else:
        return 4


def get_random_user(users):
    """Select random user"""
    return random.choice(users)


def get_random_product(products):
    """Select random product"""
    return random.choice(products)


def get_random_payment_method():
    """Select random payment method"""
    return random.choice(["bancolombia", "davivienda", "cash", "transfer"])


def is_paid():
    """70% paid, 30% unpaid"""
    return random.randint(1, 100) <= 70


def is_delivery():
    """40% delivery, 60% pickup"""
    return random.randint(1, 100) <= 40


def get_quantity():
    """Random quantity 1-3"""
    return random.randint(1, 3)


def generate_item_id():
    """Generate unique item ID"""
    return f"{int(datetime.now().timestamp() * 1000)}{random.randint(0, 9999)}"[:16]


def create_order_item(product, quantity):
    """Create order item from product"""
    price = product.get('currentPrice', 0)
    cost_price = product.get('costPrice', 0)
    tax_pct = product.get('taxPercentage', 0)

    subtotal = price * quantity
    tax_amount = int(subtotal * tax_pct / 100)
    item_total = subtotal + tax_amount

    return {
        "id": generate_item_id(),
        "productId": product.get('id'),
        "productName": product.get('name', ''),
        "productDescription": "",
        "collectionId": product.get('collectionId', ''),
        "collectionName": product.get('collectionName', ''),
        "quantity": quantity,
        "basePrice": price,
        "currentPrice": price,
        "costPrice": cost_price,
        "taxPercentage": tax_pct,
        "isComplimentary": False,
        "productionBatch": 1,
        "status": 0,
        "combination": None,
        "variation": None,
        "taxAmount": tax_amount,
        "preTaxPrice": subtotal,
        "subtotal": item_total
    }


def create_order(date, user, products_list, num_items):
    """Create order JSON"""
    paid = is_paid()
    delivery = is_delivery()
    payment_method = get_random_payment_method()
    delivery_fee = 7000 if delivery else 0

    # Generate order items
    order_items = []
    for _ in range(num_items):
        product = get_random_product(products_list)
        quantity = get_quantity()
        order_items.append(create_order_item(product, quantity))

    # Calculate totals
    subtotal = sum(item['subtotal'] for item in order_items)
    tax_amount = sum(item['taxAmount'] for item in order_items)
    total = subtotal + delivery_fee

    iso_date = date.strftime("%Y-%m-%dT12:00:00.000Z")
    payment_date = iso_date if paid else None

    order = {
        "userId": user.get('id'),
        "userName": user.get('name', user.get('firstName', 'Unknown')),
        "userEmail": user.get('email', ''),
        "userPhone": user.get('phone', ''),
        "userNationalId": user.get('nationalId', ''),
        "userLegalName": user.get('legalName', ''),
        "userCategory": user.get('category', 'B2C'),
        "orderItems": order_items,
        "preparationDate": iso_date,
        "dueDate": iso_date,
        "paymentDate": payment_date,
        "partialPaymentDate": "",
        "partialPaymentAmount": None,
        "dueTime": "",
        "status": 0,
        "isPaid": paid,
        "isDeliveryPaid": False,
        "paymentMethod": payment_method,
        "fulfillmentType": "delivery" if delivery else "pickup",
        "deliveryAddress": "" if not delivery else user.get('address', ''),
        "deliveryInstructions": "",
        "deliveryDriverId": "-",
        "driverMarkedAsPaid": False,
        "deliverySequence": 1,
        "deliveryFee": delivery_fee,
        "deliveryCost": 0,
        "numberOfBags": 1,
        "isComplimentary": False,
        "isQuote": False,
        "invoiceCustomizations": {
            "termsAndConditions": "",
            "notes": "",
            "customTitle": ""
        },
        "customerNotes": "",
        "deliveryNotes": "",
        "internalNotes": "",
        "shouldUpdateClientAddress": False
    }

    return order


def post_order(order):
    """Post order to API"""
    global SUCCESSFUL_ORDERS, FAILED_ORDERS

    try:
        headers = {
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json"
        }

        url = f"{API_URL}/bakeries/{BAKERY_ID}/orders"
        response = requests.post(url, json=order, headers=headers, timeout=10)

        if response.status_code in [200, 201]:
            SUCCESSFUL_ORDERS += 1
            return True
        else:
            FAILED_ORDERS += 1
            with open(LOG_FILE, 'a') as f:
                f.write(f"{order['preparationDate']}: {response.status_code} - {response.text}\n")
            return False
    except Exception as e:
        FAILED_ORDERS += 1
        with open(LOG_FILE, 'a') as f:
            f.write(f"{order['preparationDate']}: ERROR - {str(e)}\n")
        return False


def is_sunday(date):
    """Check if date is Sunday"""
    return date.weekday() == 6


def main():
    """Main execution"""
    global TOTAL_ORDERS, SKIPPED_SUNDAYS

    print("Starting order seeding for diana_lee-demo...")
    print(f"Range: {START_DATE.date()} to {END_DATE.date()}")
    print("Excluding Sundays")
    print("")

    # Load data
    try:
        users, products = load_data()
        print(f"✓ Loaded {len(users)} users and {len(products)} products")
        print("")
    except Exception as e:
        print(f"{RED}Error loading data: {e}{NC}")
        return

    # Clear log
    LOG_FILE.write_text("")

    # Process each date
    current = START_DATE
    while current <= END_DATE:
        # Skip Sundays
        if is_sunday(current):
            print(f"{YELLOW}⊘{NC} {current.date()} (Sunday - skipped)")
            SKIPPED_SUNDAYS += 1
            current += timedelta(days=1)
            continue

        # Get order count
        order_count = get_order_count()
        TOTAL_ORDERS += order_count

        if order_count == 0:
            print(f"{YELLOW}○{NC} {current.date()} (0 orders)")
        else:
            print(f"{current.date()}: Creating {order_count} orders... ", end="", flush=True)

            for i in range(order_count):
                user = get_random_user(users)
                num_items = get_quantity()

                order = create_order(current, user, products, num_items)

                if post_order(order):
                    print(f"{GREEN}✓{NC} ", end="", flush=True)
                else:
                    print(f"{RED}✗{NC} ", end="", flush=True)

            print("")

        current += timedelta(days=1)

    # Summary
    print("")
    print("=" * 42)
    print("Seeding Complete!")
    print("=" * 42)
    print(f"Sundays skipped: {SKIPPED_SUNDAYS}")
    print(f"Total orders attempted: {TOTAL_ORDERS}")
    print(f"{GREEN}Successful: {SUCCESSFUL_ORDERS}{NC}")
    print(f"{RED}Failed: {FAILED_ORDERS}{NC}")
    print("=" * 42)

    if FAILED_ORDERS > 0:
        print(f"See {LOG_FILE} for details")


if __name__ == "__main__":
    main()
