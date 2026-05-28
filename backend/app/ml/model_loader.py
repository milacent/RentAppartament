import builtins
import re
import sys
from pathlib import Path
from typing import Any, Dict

import joblib
import numpy as np
import pandas as pd

from app.core.config import settings
from app.core.exceptions import InternalServerError
from app.utils.logger import logger


class ModelLoader:
    """Load and cache the rental price model."""

    _model_dict = None
    _model_path = None
    _model_mtime = None

    @classmethod
    def load_model(cls) -> Dict[str, Any]:
        """Load model from disk once and keep it in memory."""
        # reload if not loaded or model file changed on disk
        model_path = Path(settings.MODEL_PATH)
        model_mtime = model_path.stat().st_mtime if model_path.exists() else None
        if cls._model_dict is None or cls._model_path is None or cls._model_mtime != model_mtime:
            try:
                if not model_path.exists():
                    raise FileNotFoundError(f"Model not found at {settings.MODEL_PATH}")

                cls._model_dict = cls._load_pickle(model_path)
                cls._model_path = model_path
                cls._model_mtime = model_mtime
                cls._validate_model_dict()
                cls._patch_model_function_globals()

                logger.info(
                    "Model loaded successfully. Features: "
                    f"{len(cls._model_dict['selected_features'])}"
                )
                logger.info(
                    "CB Features sample: "
                    f"{cls._model_dict['cb_features'][:10] if cls._model_dict['cb_features'] else 'None'}"
                )
            except Exception as e:
                logger.error(f"Failed to load model: {e}")
                raise InternalServerError(f"Failed to load model: {str(e)}")

        return cls._model_dict

    @classmethod
    def get_model(cls) -> Dict[str, Any]:
        return cls.load_model()

    @classmethod
    def _load_pickle(cls, model_path: Path) -> Dict[str, Any]:
        added_builtin_alias = False
        try:
            if "__builtin__" not in sys.modules:
                sys.modules["__builtin__"] = builtins
                added_builtin_alias = True

            try:
                return joblib.load(str(model_path))
            except Exception as joblib_error:
                logger.warning(
                    f"joblib.load failed ({joblib_error}), trying dill.load fallback"
                )
                import dill

                with model_path.open("rb") as file:
                    return dill.load(file)
        finally:
            if added_builtin_alias:
                sys.modules.pop("__builtin__", None)

    @classmethod
    def _validate_model_dict(cls) -> None:
        if "final_model" not in cls._model_dict:
            raise ValueError("Model missing 'final_model' key")
        if "cb_features" not in cls._model_dict:
            raise ValueError("Model missing 'cb_features' key")

        cls._model_dict["selected_features"] = cls._model_dict.get("cb_features", [])

        fallback_helpers = {
            "russian_stopwords": set(),
            "lemmatize": lambda x: x,
            "clean_text": lambda x: x,
            "extract_keywords": lambda x: {},
            "extract_city": lambda x: "Unknown",
            "extract_city_from_region": lambda x: "Unknown",
            "strip_city_from_address": lambda address, region=None: str(address or ''),
            "extract_street_type": lambda x: "unknown",
            "is_central_metro": lambda x: 0,
        }

        for key, fallback in fallback_helpers.items():
            if key not in cls._model_dict:
                logger.warning(f"Model missing '{key}' - using fallback")
                cls._model_dict[key] = fallback

        if "extract_city_from_region" not in cls._model_dict and "extract_city" in cls._model_dict:
            cls._model_dict["extract_city_from_region"] = cls._model_dict["extract_city"]

    @classmethod
    def _patch_model_function_globals(cls) -> None:
        """Restore globals needed by helper functions serialized inside pickle."""
        common_globals = {
            "pd": pd,
            "np": np,
            "re": re,
        }
        for key in (
            "clean_text",
            "extract_city",
            "extract_city_from_region",
            "strip_city_from_address",
            "extract_keywords",
            "extract_street_type",
            "is_central_metro",
            "lemmatize",
        ):
            func = cls._model_dict.get(key)
            func_globals = getattr(func, "__globals__", None)
            if func_globals is not None:
                func_globals.update(common_globals)

        # Provide additional helpers that serialized functions may reference
        def normalize_text(s):
            return str(s or '').strip().lower().replace('ё', 'е')

        CITY_BY_REGION = {
            'москва': 'Москва',
            'москва и мо': 'Москва',
            'московская область': 'Москва',
            'санкт-петербург': 'Санкт-Петербург',
            'санкт-петербург и ло': 'Санкт-Петербург',
            'ленинградская область': 'Санкт-Петербург',
            'казань': 'Казань',
            'екатеринбург': 'Екатеринбург',
            'новосибирск': 'Новосибирск',
            'нижний новгород': 'Нижний Новгород',
            'краснодар': 'Краснодар',
        }

        extra_globals = {
            'normalize_text': normalize_text,
            'CITY_BY_REGION': CITY_BY_REGION,
        }

        # Try to provide pymystem3 Mystem instance if available
        try:
            from pymystem3 import Mystem

            extra_globals['Mystem'] = Mystem
            try:
                extra_globals['mystem'] = Mystem()
            except Exception:
                extra_globals['mystem'] = None
        except Exception:
            # pymystem3 not available in environment
            extra_globals['Mystem'] = None
            extra_globals['mystem'] = None

        # Update globals for all serialized helper functions
        for key, obj in cls._model_dict.items():
            if callable(obj):
                fg = getattr(obj, '__globals__', None)
                if fg is not None:
                    fg.update(extra_globals)
