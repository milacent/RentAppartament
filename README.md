# ApartmentForRent

Web application for apartment rental price prediction.

The project contains a FastAPI backend with a trained ML model, a Next.js frontend, and PostgreSQL for data storage.

## Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── ml/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── utils/
│   │   └── rental_price_model.pkl
│   ├── migrations/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── public/
│   ├── src/
│   ├── Dockerfile
│   ├── package.json
│   └── package-lock.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## Requirements

- Docker
- Docker Compose

## Run

From the project root:

```bash
docker compose up -d --build
```

Open:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Stop

```bash
docker compose down
```

## Environment

The project works with Docker defaults from `docker-compose.yml`.

For local overrides, copy `.env.example` to `.env` and change values as needed. The `.env` file is intentionally ignored by Git.

## Model

The trained model must be located at:

```text
backend/app/rental_price_model.pkl
```

Inside the backend container it is loaded from:

```text
/app/app/rental_price_model.pkl
```

## Main Services

- `frontend`: Next.js application on port `3000`
- `backend`: FastAPI application on port `8000`
- `postgres`: PostgreSQL database on port `5432`

## Useful Commands

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
```
