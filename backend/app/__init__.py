from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.auth import router as auth_router
from app.api.predictions import router as predictions_router
from app.api.uploads import router as uploads_router
from app.core.config import settings
from app.core.exceptions import AppException
from app.utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.VERSION}")

    try:
        from app.models import Image, Prediction, PredictionLog, User
        from app.models.database import Base, engine

        async with engine.begin() as conn:
            logger.info(f"Database tables: {Base.metadata.tables.keys()}")
            await conn.run_sync(Base.metadata.create_all)

            required_columns = {
                "region": "VARCHAR(100)",
                "city": "VARCHAR(100)",
                "metro": "VARCHAR(100)",
                "street_type": "VARCHAR(50)",
            }
            result = await conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = 'predictions'"
                )
            )
            existing_columns = {row[0] for row in result.fetchall()}
            for column, column_type in required_columns.items():
                if column not in existing_columns:
                    await conn.execute(
                        text(f"ALTER TABLE predictions ADD COLUMN {column} {column_type}")
                    )

        await engine.dispose()
        logger.info("Database is ready")
    except Exception as error:
        logger.error(f"Database initialization failed: {error}")

    try:
        from app.ml.model_loader import ModelLoader

        ModelLoader.load_model()
        logger.info("Model loaded")
    except Exception as error:
        logger.error(f"Model loading failed: {error}")

    yield
    logger.info("Application stopped")


app = FastAPI(
    title=settings.APP_NAME,
    description="Apartment rental price prediction API",
    version=settings.VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppException)
async def app_exception_handler(request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.VERSION,
    }


@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.VERSION,
        "docs": "/docs",
    }


app.include_router(auth_router)
app.include_router(predictions_router)
app.include_router(uploads_router)
