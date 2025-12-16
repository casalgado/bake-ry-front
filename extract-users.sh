#!/bin/bash
# Extract individual user objects from JSON and save one per line
cat seed-data/users.json | sed 's/","id":"},{/\n/g' | grep '"id"' > seed-data/users-lines.json
echo "Extracted users to seed-data/users-lines.json"
head -3 seed-data/users-lines.json
