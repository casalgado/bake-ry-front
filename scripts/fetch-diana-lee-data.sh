#!/bin/bash

# Fetches users and products from diana_lee-demo bakery
# Saves to JSON files for the seeding script to use

API_URL="https://us-central1-bake-ry.cloudfunctions.net/bake"
BAKERY_ID="diana_lee-demo"
TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6IjM4MTFiMDdmMjhiODQxZjRiNDllNDgyNTg1ZmQ2NmQ1NWUzOGRiNWQiLCJ0eXAiOiJKV1QifQ.eyJyb2xlIjoic3lzdGVtX2FkbWluIiwiYmFrZXJ5SWQiOiJlcy1hbGltZW50byIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9iYWtlLXJ5IiwiYXVkIjoiYmFrZS1yeSIsImF1dGhfdGltZSI6MTc2NDk4NTQ1NiwidXNlcl9pZCI6InN5c3RlbS1hZG1pbiIsInN1YiI6InN5c3RlbS1hZG1pbiIsImlhdCI6MTc2NTgzMTMzMSwiZXhwIjoxNzY1ODM0OTMxLCJlbWFpbCI6ImRldkBjYXJzYWxoYXouY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsiZGV2QGNhcnNhbGhhei5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.lEXzJ8RUJVJHtMLJHvoLgBGLSQd6Hspeg5FhG9jij7UL_dFb9WUIw6nxCzV9YCyQyuoDceIQoEIcP5aCZuVLH_uA9Soa2b4uJC5HkSF_B6th3XC7H2Ppx0nJmH2WkSy4HmBp8shia6PD1pWuR-wst0eUOfWB1wcfxCR6dVs1nqe7QS5JJmA-58Me6Yo_WrDCoj2EpI2hzLEBUDUK6xDRE_njrl_W6lqo0a2otC0cdtv4K4-oLPcZCTJzA4qBxfxRZ_ljhdyqdwb73VsRt-OieUHtgTLtBMNmwjZavWt-I4eI_H08-NPawLXE_julrn8KcXoKDerSHmXd08FfIZLbvw"

echo "Fetching users from $API_URL/bakeries/$BAKERY_ID/users..."
curl -X GET "$API_URL/bakeries/$BAKERY_ID/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -s > ./seed-data/users.json

echo "✓ Users fetched"

echo "Fetching products from $API_URL/bakeries/$BAKERY_ID/products..."
curl -X GET "$API_URL/bakeries/$BAKERY_ID/products" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -s > ./seed-data/products.json

echo "✓ Products fetched"

# Verify files were created
if [ -s ./seed-data/users.json ] && [ -s ./seed-data/products.json ]; then
  USERS_COUNT=$(grep -o '"id":' ./seed-data/users.json | wc -l)
  PRODUCTS_COUNT=$(grep -o '"id":' ./seed-data/products.json | wc -l)
  echo ""
  echo "✓ Data fetched successfully!"
  echo "  Users: $USERS_COUNT"
  echo "  Products: $PRODUCTS_COUNT"
else
  echo "✗ Error: Failed to fetch data"
  exit 1
fi
