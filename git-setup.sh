#!/bin/bash
echo "=== INITIALIZING GIT REPOSITORY ==="
git init

echo "=== STAGING FILES ==="
# Staging all files in the project (respecting .gitignore)
git add .

echo "=== COMMITING FILES ==="
git commit -m "initial project commit"

echo "=== CONFIGURING BRANCH AND REMOTE ==="
git branch -M main

# If remote already exists, remove it first to avoid conflicts
git remote remove origin 2>/dev/null
git remote add origin git@github.com:Sohidul-Islam/catering-service.git

echo "=== PUSHING TO GITHUB ==="
git push -u origin main
