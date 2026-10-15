# ChatSphere — Real-Time Chat App

A beginner-friendly full-stack one-to-one chat application built with React + Vite, Express, MongoDB, JWT, bcrypt, and Socket.IO.

## Features
- Sign up and log in
- Password hashing with bcrypt
- JWT-protected API routes
- List registered users
- Real-time one-to-one messages
- Message history saved in MongoDB
- Online/offline status while the server is running
- Responsive layout

## Requirements
- Node.js 20+
- MongoDB running locally, or a MongoDB Atlas connection string

## 1. Configure the backend
Open a terminal in `ChatSphere/backend`:

```bash
npm install
```

Copy `.env.example` to `.env`, then set your MongoDB URI and a long random JWT secret.

```bash
npm run dev
```

The API runs at `http://localhost:5000`.

## 2. Configure the frontend
Open another terminal in `ChatSphere/frontend`:

```bash
npm install
```

Copy `.env.example` to `.env` if needed. The default API URL is `http://localhost:5000`.

```bash
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`.

## Important
- Start MongoDB before starting the backend.
- Never commit `.env` files or share your JWT secret.
- This is a learning project. Before production, add rate limiting, email verification, stronger input validation, logging, and deployment-specific security settings.
