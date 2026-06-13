# Shared Expenses App

A production-ready full-stack application for managing and splitting shared expenses, resolving historical anomalies, and tracking group membership timelines.

## Tech Stack
- **Frontend**: React (Vite) + Tailwind CSS
- **Backend**: Node.js + Express
- **Database / ORM**: PostgreSQL + Prisma ORM

## Directory Structure
```
Shared Expenses App/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Prisma schema
│   ├── src/
│   │   ├── controllers/           # API handlers
│   │   ├── middleware/            # JWT auth & error handling
│   │   ├── routes/                # Express router endpoints
│   │   └── services/              # Import parsing & balance engine
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/            # UI widgets
│   │   ├── context/               # Global state (Auth, Group)
│   │   ├── pages/                 # Full pages (Dashboard, Import review, Login)
│   │   └── services/              # Axios API clients
│   └── package.json
├── docker-compose.yml             # Dev PostgreSQL image configuration
├── .env.template                  # Template environment variables
├── DECISIONS.md                   # Key design choices and options considered
├── SCOPE.md                       # Comprehensive log of 12+ CSV anomalies & policies
└── AI_USAGE.md                    # AI usage disclosure and correction logs
```

## Setup Instructions

### 1. Database Setup
Start the local PostgreSQL container:
```bash
docker-compose up -d
```

### 2. Environment Variables
Copy `.env.template` to a new `.env` file inside the `backend` directory and adjust values as needed:
```bash
cp .env.template backend/.env
```

### 3. Backend Installation
Install dependencies and generate the Prisma Client:
```bash
cd backend
npm install
npx prisma generate
```

### 4. Frontend Installation
Install client-side dependencies:
```bash
cd ../frontend
npm install
```
