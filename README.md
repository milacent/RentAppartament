# 🏠 ApartmentForRent - Прогноз цен на аренду квартир

Полнофункциональное веб-приложение для прогнозирования стоимости аренды квартир с использованием машинного обучения (CatBoost).

**Status**: ✅ Production-ready | **Version**: 1.0.0

---

## 📖 Содержание

1. [Как работает сервис](#-как-работает-сервис)
2. [Общая информация](#-общая-информация)

---

# 🔧 Как работает сервис

## Архитектура приложения

Проект построен на **трёхслойной архитектуре** (3-tier):

```
┌─────────────────────────────────┐
│     Presentation (Next.js)      │
│   React компоненты + Zustand    │
└────────────────┬────────────────┘
                 │ REST API
┌────────────────▼────────────────┐
│    Application (FastAPI)        │
│  - Валидация (Pydantic)         │
│  - Бизнес-логика (Services)     │
│  - ML предсказания              │
└────────────────┬────────────────┘
                 │
┌────────────────▼────────────────┐
│   Data Access (SQLAlchemy ORM)  │
│   - Repositories                │
│   - Database queries            │
└────────────────┬────────────────┘
                 │
┌────────────────▼────────────────┐
│     PostgreSQL Database         │
└─────────────────────────────────┘
```

## Основные компоненты

### Backend (FastAPI)
```
backend/app/
├── api/
│   ├── auth/          → Аутентификация (регистрация, логин)
│   ├── predictions/   → Прогноз цены квартир
│   └── uploads/       → Загрузка изображений
├── services/          → Бизнес-логика
├── repositories/      → Data Access Layer
├── models/            → SQLAlchemy ORM модели
├── ml/
│   ├── model_loader.py     → Загрузка CatBoost модели
│   └── simple_preprocessor.py → Обработка входных данных
├── core/
│   ├── config.py      → Конфигурация (env переменные)
│   ├── security.py    → JWT, хеширование
│   └── exceptions.py  → Custom ошибки
└── utils/             → Логирование, валидаторы, декораторы
```

### Frontend (Next.js 15)
```
frontend/src/
├── app/              → App Router (маршрутизация)
│   ├── page.tsx      → Home page
│   ├── auth/         → Логин, регистрация
│   ├── dashboard/    → История предсказаний
│   └── analytics/    → Статистика
├── components/       → Переиспользуемые UI компоненты
├── services/api.ts   → HTTP клиент (Axios)
├── store/            → Zustand глобальное состояние
└── types/            → TypeScript интерфейсы
```

## Поток предсказания (End-to-End)

```
1. User fills form          2. POST /api/predictions/predict
   (Frontend)                   (Backend validation + processing)
        ↓                              ↓
   Upload image          3. ML Preprocessing
        ↓                   - Text normalization
   [ImageUpload]          - Lemmatization (pymystem3)
        ↓                   - Feature encoding
   Zustand state              ↓
        ↓              4. CatBoost Model Inference
   Axios POST           → Model.predict(features)
        ↓                   ↓
   API Response         5. Save to PredictionLog (DB)
   (predicted_price)        ↓
        ↓              6. Return JSON response
   [Dashboard]              ↓
   Display + Chart      7. [Dashboard] Display prediction
```

## Технические решения

### 1. Аутентификация (JWT)
- **Алгоритм**: HS256 (HMAC SHA-256)
- **Access Token**: Срок 30 минут
- **Refresh Token**: Срок 7 дней
- **Хранение**: bcrypt хеширование паролей

### 2. ML Модель
- **Тип**: CatBoost (Gradient Boosting)
- **Формат**: pickle (.pkl file)
- **Входные признаки**: регион, метро, комнаты, площадь, описание
- **Выход**: прогноз цены (тысячи рублей)

**Обработка текста (описание квартиры)**:
```
Сырой текст
    ↓
Нормализация (lowercase, спецсимволы)
    ↓
Токенизация
    ↓
Лемматизация (pymystem3 - MS Word формы)
    ↓
Векторизация признаков
    ↓
CatBoost prediction
```

### 3. База данных
- **СУБД**: PostgreSQL 16
- **ORM**: SQLAlchemy 2.0
- **Миграции**: Alembic

**Таблицы**:
- `users` - Профили пользователей
- `predictions` - Сохранённые предсказания
- `prediction_logs` - История всех предсказаний (для аналитики)
- `images` - Метаданные изображений

### 4. Мониторинг (Production)
- Мониторинг и alerting не настроены в этом репозитории
- В текущем состоянии приложение предоставляет только базовые health- и статус-эндпоинты

## API Endpoints

### Auth (`/api/auth`)
```
POST   /register        → Регистрация
POST   /login           → Получить JWT токен
POST   /refresh         → Обновить токен
POST   /logout          → Выход
```

### Predictions (`/api/predictions`) - Требует JWT
```
POST   /predict                    → Получить прогноз
GET    /predictions                → История предсказаний
GET    /predictions/{id}           → Детали предсказания
DELETE /predictions/{id}           → Удалить предсказание
```

### Uploads (`/api/uploads`) - Требует JWT
```
POST   /upload              → Загрузить изображение
GET    /image/{filename}    → Скачать изображение
```

### Health Check
```
GET    /health              → Проверка здоровья (без auth)
GET    /docs                → Swagger UI документация
```

**Полный пример POST /predict**:
```json
{
  "region": "Москва и МО",
  "city": "Москва",
  "metro": "Красные ворота",
  "time_to_metro": 5,
  "address": "ул. Примерная, 1",
  "rooms": 2,
  "total_area": 60.5,
  "description": "Комфортная квартира с евроремонтом"
}
```

**Response**:
```json
{
  "id": "pred_12345",
  "predicted_price": 45000,
  "predicted_price_min": 42000,
  "predicted_price_max": 48000,
  "created_at": "2024-05-28T10:30:00Z"
}
```

---

# 📋 Общая информация

## 🛠️ Технический стек

### Backend
- **FastAPI** 0.104.1 - REST API framework
- **Uvicorn** - ASGI сервер
- **SQLAlchemy** 2.0 - ORM
- **Alembic** - Миграции БД
- **PostgreSQL** 16 - База данных
- **CatBoost** - ML модель (gradient boosting)
- **scikit-learn**, **pandas**, **numpy** - Data science
- **pymystem3** - Лемматизация русского текста
- **python-jose** - JWT токены
- **bcrypt** - Хеширование паролей

### Frontend
- **Next.js** 15 - React фреймворк с SSR
- **React** 18 - UI библиотека
- **TypeScript** 5.6 - Типизация
- **Tailwind CSS** 3.4 - Стили
- **Zustand** - State management
- **Axios** - HTTP клиент
- **Recharts** - Графики и диаграммы
- **Heroicons** - UI иконки

### DevOps & Deployment
- **Docker** & **Docker Compose** - Контейнеризация
- **GitHub Actions** - CI/CD
- В репозитории нет готовой production-платформы мониторинга

## 📁 Структура проекта

```
RentAppartament/
├── .github/
│   └── workflows/ci.yml           # GitHub Actions CI/CD
├── backend/
│   ├── app/
│   │   ├── api/                   # API endpoints
│   │   ├── services/              # Бизнес-логика
│   │   ├── repositories/          # Data Access Layer
│   │   ├── models/                # Database models
│   │   ├── ml/                    # ML компоненты
│   │   ├── core/                  # Config, security
│   │   ├── utils/                 # Утилиты
│   │   ├── rental_price_model.pkl # Обученная модель
│   │   └── __init__.py            # FastAPI app
│   ├── migrations/                # Alembic миграции
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/                   # Next.js App Router
│   │   ├── components/
│   │   ├── services/
│   │   ├── store/
│   │   └── types/
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── next.config.js
│   └── Dockerfile
├── docker-compose.yml              # Development
├── uploads/                        # Хранилище изображений
├── .env.example                    # Пример конфигурации
└── README.md                       # Этот файл
```

## 🚀 Быстрый старт

### С Docker (рекомендуется)

1. **Клонируйте репозиторий**:
```bash
git clone https://github.com/your-repo/RentAppartament.git
cd RentAppartament
```

2. **Создайте `.env`** из примера:
```bash
cp .env.example .env
```

3. **Запустите контейнеры**:
```bash
docker compose up -d --build
```

4. **Откройте приложение**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

### Локально (без Docker)

**Backend**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/macOS
# или venv\Scripts\activate (Windows)

pip install -r requirements.txt

# Создайте .env:
export DATABASE_URL="postgresql://apartment_user:password@localhost:5432/apartment_rent"
export SECRET_KEY="dev-secret-min-32-chars"

# Запустите PostgreSQL (опционально через Docker):
docker run -d --name postgres -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=apartment_rent -p 5432:5432 postgres:16-alpine

# Применить миграции:
alembic upgrade head

# Запустить сервер:
uvicorn app:app --reload --port 8000
```

**Frontend**:
```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

Откройте http://localhost:3000

## 🔒 Переменные окружения (`.env`)

```env
# Backend
DEBUG=False
APP_NAME=ApartmentForRent
SECRET_KEY=your-secret-key-min-32-chars
DATABASE_URL=postgresql://apartment_user:password@postgres:5432/apartment_rent
MODEL_PATH=/app/app/rental_price_model.pkl

# PostgreSQL
POSTGRES_USER=apartment_user
POSTGRES_PASSWORD=password
POSTGRES_DB=apartment_rent

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000

# JWT
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# File Upload
MAX_FILE_SIZE=10485760  # 10 MB
UPLOAD_DIR=/app/uploads
```

## 🧪 Тестирование

### Backend
```bash
cd backend
pip install pytest pytest-cov

# Запустить тесты
pytest -v --cov=app tests/

# Lint проверка
pip install flake8
flake8 app --max-line-length=127
```

### Frontend
```bash
cd frontend
npm run lint          # ESLint
npm run type-check    # TypeScript
npm run build         # Prod build
```

## 🐛 Troubleshooting

### ❌ "Контейнер падает при запуске"
```bash
# Проверьте логи:
docker compose logs backend
docker compose logs frontend

# Проверьте переменные в .env:
cat .env
```

### ❌ "Ошибка подключения к БД"
```bash
# Убедитесь PostgreSQL запущен:
docker compose exec postgres pg_isready

# Или подключитесь:
psql postgresql://apartment_user:password@localhost:5432/apartment_rent
```

### ❌ "Модель не загружается"
```bash
# Проверьте что файл в контейнере:
docker compose exec backend ls -la /app/app/rental_price_model.pkl

# Проверьте путь в config.py:
# MODEL_PATH должен быть: /app/app/rental_price_model.pkl
```

### ❌ "CORS ошибка при запросах"
Проверьте `CORS_ORIGINS` в `backend/app/core/config.py`:
```python
CORS_ORIGINS: List[str] = [
    "http://localhost:3000",  # Frontend должен быть тут
    "http://localhost:8000",
]
```

### ❌ "Долгая сборка Docker контейнера"
**Причина**: CatBoost собирается долго (компилируется C++)

**Решение**:
- Первая сборка займет 5-15 минут (это нормально)
- Следующие сборки будут быстрее (layer caching)
- Используйте `docker compose build backend` для отдельной сборки

### ❌ "ModuleNotFoundError в Python"
```bash
# Убедитесь PYTHONPATH верен:
export PYTHONPATH="${PYTHONPATH}:$(pwd)/backend"

# Или переустановите зависимости:
pip install -r backend/requirements.txt
```

### ❌ "Port already in use"
```bash
# Измените порты в docker-compose.yml или .env:
# Или убейте процесс на портах:
lsof -i :8000  # На macOS/Linux
netstat -ano | findstr :8000  # На Windows
```

## 📊 CI/CD Pipeline

**GitHub Actions** (`.github/workflows/ci.yml`):

Запускается на `push` и `pull_request` для веток: `main`, `master`, `develop`, `test_ci`

**Jobs**:
1. ✅ Backend тесты (flake8 lint, pytest с coverage)
2. ✅ Frontend тесты (eslint, type-check, build)
3. ✅ Docker образы (build backend & frontend)

## 🌍 Deployment

Для локальной разработки используйте основной compose-файл:

```bash
docker compose up -d --build
```

Откройте:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

> В репозитории нет готовой конфигурации Prometheus/Grafana или alertmanager. Мониторинг не включен по умолчанию.

## 🔄 Обновление и maintenance

### Запуск миграций БД
```bash
cd backend
alembic revision --autogenerate -m "Your migration"
alembic upgrade head
```

### Обновление зависимостей
```bash
# Backend
cd backend
pip install --upgrade -r requirements.txt

# Frontend
cd frontend
npm update
```

### Логирование и отладка
```bash
# Просмотр логов контейнеров
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres

# Интерактивный шелл в контейнере
docker compose exec backend bash
docker compose exec frontend sh
```

## 📝 Разработка

### Добавление нового endpoint

1. Создайте schema в `backend/app/schemas/`
2. Создайте service в `backend/app/services/`
3. Создайте route в `backend/app/api/`
4. Импортируйте в `backend/app/__init__.py`

### Git Workflow
```bash
git checkout -b feature/your-feature
# Работа...
git add .
git commit -m "feat: description"
git push origin feature/your-feature
# Создайте Pull Request
```

## ✅ Checklist перед production

- [ ] Изменить `SECRET_KEY` на новое сложное значение
- [ ] Установить `DEBUG=False`
- [ ] Настроить HTTPS/TLS
- [ ] Установить production DATABASE_URL
- [ ] Настроить мониторинг и алертинг, если он нужен в продакшене
- [ ] Добавить rate limiting
- [ ] Включить CSRF protection
- [ ] Настроить backup для БД
- [ ] Настроить логирование и мониторинг
- [ ] Провести security audit кода

## 📞 Поддержка

Для вопросов:
1. Проверьте раздел [Troubleshooting](#-troubleshooting)
2. Посмотрите Swagger UI: http://localhost:8000/docs
3. Проверьте логи контейнеров: `docker compose logs backend`

---

**Made with ❤️ | Version 1.0.0 | Production Ready**

---

## 🎯 Обзор проекта

**ApartmentForRent** - полнофункциональное веб-приложение для прогнозирования стоимости аренды квартир. Система анализирует различные факторы (район, метро, количество комнат, площадь) и предсказывает цену используя обученную CatBoost модель.

### Основные возможности:
- ✅ Прогноз цены аренды квартиры в реальном времени
- ✅ Загрузка и сохранение истории предсказаний
- ✅ Аутентификация пользователей (JWT)
- ✅ Хранение прогнозов и изображений в БД
- ✅ Обработка естественного языка (лемматизация русского текста)
- ✅ REST API + веб-интерфейс
- ✅ Docker контейнеризация

---

## 🛠️ Технический стек

### Backend
- **Framework**: FastAPI 0.104.1
- **Server**: Uvicorn
- **ORM**: SQLAlchemy 2.0 + Alembic миграции
- **Database**: PostgreSQL 16
- **Auth**: JWT (python-jose)
- **ML**: CatBoost, scikit-learn, pandas, numpy
- **NLP**: pymystem3 (лемматизация русского)
- **Image Processing**: Pillow

### Frontend
- **Framework**: Next.js 15 (React 18)
- **Language**: TypeScript 5.6
- **Styling**: Tailwind CSS 3.4
- **HTTP Client**: Axios
- **State Management**: Zustand
- **UI Components**: Heroicons, React Hot Toast
- **Visualization**: Recharts (для графиков)

### DevOps
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Database**: PostgreSQL 16-alpine

---

## 📁 Структура проекта

```
RentAppartament/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/           # Аутентификация
│   │   │   ├── predictions/     # Прогнозы
│   │   │   └── uploads/         # Загрузка файлов
│   │   ├── core/
│   │   │   ├── config.py        # Конфигурация (env переменные)
│   │   │   ├── constants.py     # Константы
│   │   │   ├── exceptions.py    # Custom исключения
│   │   │   └── security.py      # JWT, хеширование
│   │   ├── ml/
│   │   │   ├── model_loader.py  # Загрузка pickle модели
│   │   │   └── simple_preprocessor.py  # Обработка данных
│   │   ├── models/
│   │   │   └── database.py      # SQLAlchemy модели
│   │   ├── repositories/        # Data access layer
│   │   ├── schemas/             # Pydantic DTO
│   │   ├── services/            # Бизнес-логика
│   │   ├── utils/               # Утилиты (логи, валидаторы)
│   │   ├── rental_price_model.pkl  # Обученная модель
│   │   └── __init__.py          # FastAPI app инициализация
│   ├── migrations/              # Alembic миграции БД
│   ├── Dockerfile              # Backend контейнер
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx       # Root layout
│   │   │   ├── page.tsx         # Home page
│   │   │   ├── auth/            # Логин, регистрация
│   │   │   ├── dashboard/       # Dashboard с предсказаниями
│   │   │   └── analytics/       # Аналитика
│   │   ├── components/          # Переиспользуемые компоненты
│   │   ├── services/            # API сервис (axios)
│   │   ├── store/               # Zustand store для аутентификации
│   │   └── types/               # TypeScript интерфейсы
│   ├── public/                  # Статические файлы
│   ├── Dockerfile              # Frontend контейнер
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── uploads/                     # Хранилище загруженных изображений
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI/CD
├── docker-compose.yml          # Оркестрация контейнеров
├── .env.example                # Пример переменных окружения
└── README.md                   # Этот файл
```

---

## 🚀 Установка и запуск

### Требования
- Docker >= 20.10
- Docker Compose >= 2.0
- (Для локальной разработки без Docker: Python 3.12, Node.js 20)

### Быстрый старт с Docker

1. **Клонируйте репозиторий**:
```bash
git clone https://github.com/your-repo/RentAppartament.git
cd RentAppartament
```

2. **Создайте `.env` файл** (скопируйте из `.env.example`):
```bash
cp .env.example .env
```

3. **Запустите контейнеры**:
```bash
docker compose up -d --build
```

4. **Проверьте статус**:
```bash
docker compose ps
```

5. **Откройте приложение**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs

### Локальная разработка (без Docker)

#### Backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # или venv\Scripts\activate на Windows
pip install -r requirements.txt

# Создайте .env файл в backend/ с переменными
export DATABASE_URL="postgresql://user:password@localhost:5432/apartment_rent"
export SECRET_KEY="your-secret-key-min-32-chars"

uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend:
```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

#### PostgreSQL (можно поднять в контейнере):
```bash
docker run -d \
  --name apartment_postgres \
  -e POSTGRES_USER=apartment_user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=apartment_rent \
  -p 5432:5432 \
  postgres:16-alpine
```

---

## 📡 API Endpoints

### Аутентификация (`/api/auth`)
- `POST /register` - Регистрация нового пользователя
- `POST /login` - Вход (получить JWT токен)
- `POST /refresh` - Обновить токен
- `POST /logout` - Выход

### Предсказания (`/api/predictions`)
- `POST /predict` - Получить прогноз цены на аренду
- `GET /predictions` - Получить историю предсказаний текущего пользователя
- `GET /predictions/{id}` - Получить детали конкретного предсказания
- `DELETE /predictions/{id}` - Удалить предсказание

### Загрузка файлов (`/api/uploads`)
- `POST /upload` - Загрузить изображение квартиры
- `GET /image/{filename}` - Получить изображение

### Health Check
- `GET /health` - Проверка здоровья приложения

**Полная документация**: http://localhost:8000/docs (Swagger UI)

---

## 🏗️ Архитектура

### Слои приложения:

```
┌─────────────────────────────────┐
│   Frontend (Next.js)            │
│   - Компоненты (React)          │
│   - Состояние (Zustand)         │
│   - API вызовы (Axios)          │
└──────────────┬──────────────────┘
               │ HTTP/REST
┌──────────────▼──────────────────┐
│   API Layer (FastAPI)           │
│   - auth.py (аутентификация)    │
│   - predictions.py (предсказанния)
│   - uploads.py (загрузки)       │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│   Services Layer                │
│   - AuthService                 │
│   - PredictionService           │
│   - ImageService                │
│   - UserService                 │
└──────────────┬──────────────────┘
               │
┌──────────────┴──────────────────┐
│                                 │
├─────────────────────────────────┤
│   ML Module                     │
│   - model_loader.py (CatBoost)  │
│   - preprocessor.py (обработка) │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│   Repository Layer (DAL)        │
│   - UserRepository              │
│   - PredictionRepository        │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│   Database Layer                │
│   - PostgreSQL                  │
│   - SQLAlchemy ORM              │
└─────────────────────────────────┘
```

### Поток предсказания:

1. Пользователь заполняет форму на фронтенде
2. Frontend отправляет POST на `/api/predictions/predict`
3. API валидирует данные (Pydantic)
4. PredictionService вызывает ML Preprocessor
5. Preprocessor обрабатывает текст (лемматизация) и числовые признаки
6. CatBoost модель делает прогноз
7. Результат сохраняется в PredictionLog (DB)
8. API возвращает прогноз с визуализацией на фронтенде

---

## 👨‍💻 Разработка

### Добавление нового API endpoint

1. Создайте route в `backend/app/api/new_feature/__init__.py`:
```python
from fastapi import APIRouter

router = APIRouter(prefix="/new-feature", tags=["new-feature"])

@router.get("/")
async def get_data():
    return {"message": "Hello"}
```

2. Импортируйте в `backend/app/__init__.py`:
```python
from app.api.new_feature import router as new_router
app.include_router(new_router)
```

### Запуск тестов

```bash
cd backend
pip install pytest pytest-cov
pytest -v --cov=app tests/
```

### Форматирование кода

```bash
pip install flake8 black
flake8 backend/app
black backend/app
```

---

## 🌍 Deployment

### Production с Docker

1. **Подготовьте `.env` с production переменными**:
```env
DEBUG=False
SECRET_KEY=your-very-secret-key-min-32-chars
DATABASE_URL=postgresql://user:password@prod-db:5432/apartment_rent
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
POSTGRES_PASSWORD=very-strong-password
```

2. **Используйте Docker Compose**:
```bash
docker compose -f docker-compose.yml up -d
```

3. **Используйте обратный прокси** (Nginx/Caddy):
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Масштабирование

- Используйте переменные окружения для конфигурации
- Увеличьте количество worker процессов Uvicorn
- Добавьте Redis для кеширования (опционально)
- Используйте CDN для статических файлов фронтенда

---

## 🐛 Troubleshooting

### "Контейнер падает при запуске"

**Решение**: Проверьте логи:
```bash
docker compose logs backend
docker compose logs frontend
```

### "Ошибка подключения к БД"

**Решение**: Убедитесь, что PostgreSQL запущен и переменные `DATABASE_URL` верны:
```bash
docker compose exec postgres pg_isready
```

### "Модель не загружается"

**Решение**: Проверьте путь в `config.py`:
```python
MODEL_PATH: str = "/app/app/rental_price_model.pkl"
```

Убедитесь, что файл существует в контейнере.

### "Ошибка CORS при запросах с фронтенда"

**Решение**: Проверьте `CORS_ORIGINS` в `backend/app/core/config.py`. Должен содержать `http://localhost:3000` для разработки.

### "Долгая сборка контейнера"

**Причина**: CatBoost собирается долго (требует компиляции C++)

**Решение**: 
- Просто подождите первую сборку
- Используйте `docker compose build` отдельно
- Для CI/CD кешируйте слои Docker

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
